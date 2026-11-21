/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { erpEngine } from '../services/erpEngine';
import { 
  ContactMasterRecord, 
  ContactTrackingRecord, 
  EventMasterRecord, 
  EventTrackingRecord 
} from '../types/erp';
import { 
  Contact, 
  Calendar, 
  Image as ImageIcon, 
  PlusCircle, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  FileText,
  UserCheck,
  Send,
  Camera,
  ExternalLink
} from 'lucide-react';

interface CrmEventsViewProps {
  eventsOnlyMode?: boolean;
  scopedTitle?: string;
  onNavigateToMemberNodes?: (mid: string) => void;
  onNavigateToRegister?: () => void;
}

export const CrmEventsView: React.FC<CrmEventsViewProps> = ({
  eventsOnlyMode = false,
  scopedTitle,
  onNavigateToMemberNodes,
  onNavigateToRegister,
}) => {
  const [activeTab, setActiveTab] = useState<'CONTACT_M' | 'CONTACT_T' | 'EVENT_M' | 'EVENT_T'>(
    eventsOnlyMode ? 'EVENT_M' : 'CONTACT_M'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  // Modals state
  const [isNewContactModalOpen, setIsNewContactModalOpen] = useState(false);
  const [isNewTrackingModalOpen, setIsNewTrackingModalOpen] = useState(false);
  const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false);
  const [isNewHighlightModalOpen, setIsNewHighlightModalOpen] = useState(false);

  // Selected contact for adding tracking
  const [selectedContactForTracking, setSelectedContactForTracking] = useState<ContactMasterRecord | null>(null);

  // Form states - Contact
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactTel, setNewContactTel] = useState('');
  const [newContactLine, setNewContactLine] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactAddress, setNewContactAddress] = useState('');
  const [newContactPhoto, setNewContactPhoto] = useState('');

  // Form states - Tracking
  const [newTrackingName, setNewTrackingName] = useState('');
  const [newTrackingDate, setNewTrackingDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTrackingMethod, setNewTrackingMethod] = useState('線上開通');
  const [newTrackingDiscussion, setNewTrackingDiscussion] = useState('');
  const [newTrackingNextPlan, setNewTrackingNextPlan] = useState('');
  const [newTrackingPhoto, setNewTrackingPhoto] = useState('');
  const [newTrackingStatus, setNewTrackingStatus] = useState('已完成');

  // Form states - Event
  const [newEventTheme, setNewEventTheme] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventBudget, setNewEventBudget] = useState('30000');
  const [newEventLeader, setNewEventLeader] = useState('');
  const [newEventNotes, setNewEventNotes] = useState('');
  const [newEventPhoto, setNewEventPhoto] = useState('');

  // Form states - Event Tracking
  const [newHighlightTheme, setNewHighlightTheme] = useState('');
  const [newHighlightTitle, setNewHighlightTitle] = useState('');
  const [newHighlightLocation, setNewHighlightLocation] = useState('');
  const [newHighlightNotes, setNewHighlightNotes] = useState('');
  const [newHighlightPhoto, setNewHighlightPhoto] = useState('');

  // Data collections
  const contacts = erpEngine.getAllContacts();
  const trackings = erpEngine.getAllContactTrackings();
  const events = erpEngine.getAllEvents();
  const highlights = erpEngine.getAllEventTrackings();

  // Handlers
  const handleCreateContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName || !newContactPhone) return;

    erpEngine.addContact({
      name: newContactName,
      phone: newContactPhone,
      tel: newContactTel,
      line: newContactLine,
      email: newContactEmail,
      address: newContactAddress,
      photoUrl: newContactPhoto,
      status: '開通AI軟體1+1',
    });

    setIsNewContactModalOpen(false);
    setNewContactName('');
    setNewContactPhone('');
    setNewContactTel('');
    setNewContactLine('');
    setNewContactEmail('');
    setNewContactAddress('');
    setNewContactPhoto('');
  };

  const handleCreateTracking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrackingName || !newTrackingDiscussion) return;

    erpEngine.addContactTracking({
      name: newTrackingName,
      contactDate: newTrackingDate,
      contactMethod: newTrackingMethod,
      discussionContent: newTrackingDiscussion,
      nextStepPlan: newTrackingNextPlan,
      photoUrl: newTrackingPhoto,
      status: newTrackingStatus,
      contactId: selectedContactForTracking?.id,
      memberMid: selectedContactForTracking?.memberMid,
    });

    setIsNewTrackingModalOpen(false);
    setSelectedContactForTracking(null);
    setNewTrackingName('');
    setNewTrackingDiscussion('');
    setNewTrackingNextPlan('');
    setNewTrackingPhoto('');
  };

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTheme || !newEventDate || !newEventLocation) return;

    erpEngine.addEvent({
      eventTheme: newEventTheme,
      date: newEventDate,
      location: newEventLocation,
      budget: Number(newEventBudget) || newEventBudget,
      leader: newEventLeader,
      notes: newEventNotes,
      photoUrl: newEventPhoto,
      status: '報名中',
    });

    setIsNewEventModalOpen(false);
    setNewEventTheme('');
    setNewEventDate('');
    setNewEventLocation('');
    setNewEventBudget('30000');
    setNewEventLeader('');
    setNewEventNotes('');
    setNewEventPhoto('');
  };

  const handleCreateHighlight = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHighlightTheme || !newHighlightTitle || !newHighlightPhoto) return;

    erpEngine.addEventTracking({
      eventTheme: newHighlightTheme,
      photoTitle: newHighlightTitle,
      shootLocation: newHighlightLocation || '培訓教室現場',
      contentNotes: newHighlightNotes,
      photoUrl: newHighlightPhoto,
      status: '公開發布',
    });

    setIsNewHighlightModalOpen(false);
    setNewHighlightTheme('');
    setNewHighlightTitle('');
    setNewHighlightLocation('');
    setNewHighlightNotes('');
    setNewHighlightPhoto('');
  };

  const openTrackingForContact = (c: ContactMasterRecord) => {
    setSelectedContactForTracking(c);
    setNewTrackingName(c.name);
    setNewTrackingDiscussion(`跟進【${c.name}】AI 軟體 1+1 體驗進度：`);
    setNewTrackingNextPlan('邀請參加週末實體啟航說明會或續約 100 元閉環算力池。');
    setNewTrackingPhoto(c.photoUrl);
    setIsNewTrackingModalOpen(true);
  };

  // Filtered lists
  const filteredContacts = contacts.filter(c => 
    c.name.includes(searchTerm) || 
    c.phone.includes(searchTerm) || 
    c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.memberMid && c.memberMid.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredTrackings = trackings.filter(t =>
    t.name.includes(searchTerm) ||
    t.discussionContent.includes(searchTerm) ||
    t.contactMethod.includes(searchTerm)
  );

  const filteredEvents = events.filter(e =>
    e.eventTheme.includes(searchTerm) ||
    e.location.includes(searchTerm) ||
    e.leader.includes(searchTerm)
  );

  const filteredHighlights = highlights.filter(h =>
    h.eventTheme.includes(searchTerm) ||
    h.photoTitle.includes(searchTerm) ||
    h.shootLocation.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="text-indigo-300 font-semibold">
                {eventsOnlyMode ? '教育中心活動專屬系統' : 'Google Sheets Database Architecture'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-cyan-300">
                {eventsOnlyMode ? '活動主檔 (EM-) 與活動花絮 (ET-)' : '新會員開通 AI 軟體 1+1'}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 mt-1.5">
              <Contact className="w-5 h-5 text-indigo-400" />
              <span>
                {scopedTitle || (eventsOnlyMode ? '教育中心活動行事曆與花絮中心' : '通訊錄與活動行銷中心 (CRM & Events Portal)')}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              {eventsOnlyMode ? (
                <>
                  僅顯示教育中心職責範圍內之 <code className="text-amber-300 font-mono">EVENT_M: 活動主檔 (EM-)</code> 與 <code className="text-amber-300 font-mono">EVENT_T: 活動花絮 (ET-)</code>。全網會員通訊主檔已自動隱藏。
                </>
              ) : (
                <>
                  整合 1. 通訊錄（<code className="text-sky-300 font-mono">CONTACT_M: 通訊主檔 (CM-)</code>、<code className="text-sky-300 font-mono">CONTACT_T: 聯繫紀錄 (CT-)</code>）與 2. 活動管理（<code className="text-amber-300 font-mono">EVENT_M: 活動主檔 (EM-)</code>、<code className="text-amber-300 font-mono">EVENT_T: 活動花絮 (ET-)</code>）。新會員開通 AI 軟體 1+1 自動寫入通訊主檔與首筆開通追蹤日誌！
                </>
              )}
            </p>
          </div>

          {!eventsOnlyMode && onNavigateToRegister && (
            <div className="flex items-center gap-2">
              <button
                onClick={onNavigateToRegister}
                className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4" />
                <span>開通新會員 AI 軟體 1+1</span>
              </button>
            </div>
          )}
        </div>

        {/* KPI Summary Cards */}
        <div className={`grid grid-cols-2 ${eventsOnlyMode ? 'md:grid-cols-2' : 'md:grid-cols-4'} gap-3 mt-6`}>
          {!eventsOnlyMode && (
            <>
              <div className="bg-slate-950 p-3.5 rounded-lg border border-sky-900/40">
                <div className="text-xs text-slate-400 flex items-center justify-between">
                  <span>通訊主檔名單 (CONTACT_M)</span>
                  <Contact className="w-3.5 h-3.5 text-sky-400" />
                </div>
                <div className="text-xl font-bold font-mono text-sky-300 mt-1 tabular-nums">
                  {contacts.length} <span className="text-xs font-normal text-slate-400">人</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">前綴 CM- · imgIdx: 8 (照片連結)</div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-lg border border-sky-900/40">
                <div className="text-xs text-slate-400 flex items-center justify-between">
                  <span>聯繫追蹤紀錄 (CONTACT_T)</span>
                  <FileText className="w-3.5 h-3.5 text-sky-400" />
                </div>
                <div className="text-xl font-bold font-mono text-sky-300 mt-1 tabular-nums">
                  {trackings.length} <span className="text-xs font-normal text-slate-400">筆</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">前綴 CT- · imgIdx: 7 (照片連結)</div>
              </div>
            </>
          )}

          <div className="bg-slate-950 p-3.5 rounded-lg border border-amber-900/40">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>活動主檔場次 (EVENT_M)</span>
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-bold font-mono text-amber-300 mt-1 tabular-nums">
              {events.length} <span className="text-xs font-normal text-slate-400">場</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">前綴 EM- · imgIdx: 8 (活動海報)</div>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-lg border border-amber-900/40">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>活動實況花絮 (EVENT_T)</span>
              <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-bold font-mono text-amber-300 mt-1 tabular-nums">
              {highlights.length} <span className="text-xs font-normal text-slate-400">篇</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">前綴 ET- · imgIdx: 6 (現場高清照)</div>
          </div>
        </div>

        {/* Tabs switcher + Search bar */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800 overflow-x-auto">
            {!eventsOnlyMode && (
              <>
                <button
                  onClick={() => setActiveTab('CONTACT_M')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    activeTab === 'CONTACT_M'
                      ? 'bg-sky-600 text-white font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Contact className="w-3.5 h-3.5" />
                  <span>1. 通訊主檔 (CONTACT_M / CM-)</span>
                </button>

                <button
                  onClick={() => setActiveTab('CONTACT_T')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    activeTab === 'CONTACT_T'
                      ? 'bg-sky-700 text-white font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>1. 聯繫紀錄 (CONTACT_T / CT-)</span>
                </button>
              </>
            )}

            <button
              onClick={() => setActiveTab('EVENT_M')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'EVENT_M'
                  ? 'bg-amber-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{eventsOnlyMode ? '活動主檔 (EVENT_M / EM-)' : '2. 活動主檔 (EVENT_M / EM-)'}</span>
            </button>

            <button
              onClick={() => setActiveTab('EVENT_T')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'EVENT_T'
                  ? 'bg-amber-700 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>{eventsOnlyMode ? '活動花絮 (EVENT_T / ET-)' : '2. 活動花絮 (EVENT_T / ET-)'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="快速搜尋姓名、電話、主題或 ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 w-60"
              />
            </div>

            {activeTab === 'CONTACT_M' && (
              <button
                onClick={() => setIsNewContactModalOpen(true)}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap shadow-sm"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>新增通訊主檔</span>
              </button>
            )}

            {activeTab === 'CONTACT_T' && (
              <button
                onClick={() => {
                  setSelectedContactForTracking(null);
                  setNewTrackingName('');
                  setIsNewTrackingModalOpen(true);
                }}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap shadow-sm"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>新增聯繫紀錄</span>
              </button>
            )}

            {activeTab === 'EVENT_M' && (
              <button
                onClick={() => setIsNewEventModalOpen(true)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap shadow-sm"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>發布新活動</span>
              </button>
            )}

            {activeTab === 'EVENT_T' && (
              <button
                onClick={() => setIsNewHighlightModalOpen(true)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap shadow-sm"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>上傳活動花絮</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ================= TAB 1: 通訊主檔 (CONTACT_M / CM-) ================= */}
      {activeTab === 'CONTACT_M' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Contact className="w-4 h-4 text-sky-400" />
                <span>通訊主檔 (CONTACT_M) · 表格結構驗證</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                格式：<code className="text-sky-300 font-mono">headers: ["ID", "狀態", "姓名", "手機", "電話", "Line", "Email", "地址", "照片連結", "更新時間"]</code> · <span className="text-amber-400 font-mono">imgIdx: 8 (第 8 欄位為照片連結)</span>
              </p>
            </div>
            <div className="text-xs font-mono text-sky-300 bg-sky-950/80 px-2.5 py-1 rounded border border-sky-800">
              共 {filteredContacts.length} 筆通訊主檔
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">ID (前綴 CM-)</th>
                  <th className="py-2.5 px-3">狀態</th>
                  <th className="py-2.5 px-3">照片 (imgIdx: 8)</th>
                  <th className="py-2.5 px-3">姓名</th>
                  <th className="py-2.5 px-3">手機</th>
                  <th className="py-2.5 px-3">電話</th>
                  <th className="py-2.5 px-3">Line</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">地址</th>
                  <th className="py-2.5 px-3">更新時間</th>
                  <th className="py-2.5 px-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredContacts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-sky-400">{c.id}</td>
                    <td className="py-2.5 px-3 font-sans">
                      <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-950 text-emerald-300 border border-emerald-800">
                        {c.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {c.photoUrl && !brokenImages[c.id] ? (
                        <img
                          src={c.photoUrl}
                          alt={c.name}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-full object-cover border border-slate-700 shadow-sm"
                          onError={() => setBrokenImages((prev) => ({ ...prev, [c.id]: true }))}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-sky-950 border border-sky-800 flex items-center justify-center text-xs font-bold text-sky-300 font-sans">
                          {c.name.slice(0, 1)}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-sans font-bold text-slate-200">
                      {c.name}
                      {c.memberMid && (
                        <span className="block text-[10px] text-indigo-400 font-mono">
                          {c.memberMid}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{c.phone}</td>
                    <td className="py-2.5 px-3 text-slate-400">{c.tel}</td>
                    <td className="py-2.5 px-3 text-emerald-400">{c.line}</td>
                    <td className="py-2.5 px-3 text-slate-300">{c.email}</td>
                    <td className="py-2.5 px-3 font-sans text-slate-400 max-w-xs truncate" title={c.address}>
                      {c.address}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                      {new Date(c.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-sans space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => openTrackingForContact(c)}
                        className="text-xs text-sky-400 hover:text-sky-300 cursor-pointer font-medium"
                      >
                        + 聯繫拜訪
                      </button>
                      {c.memberMid && (
                        <button
                          onClick={() => onNavigateToMemberNodes && onNavigateToMemberNodes(c.memberMid!)}
                          className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer font-medium"
                        >
                          · 節點全貌
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredContacts.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-500 font-sans">
                      查無符合條件的通訊主檔資料。可點擊右上角「開通新會員 AI 軟體 1+1」或「新增通訊主檔」。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 2: 聯繫紀錄 (CONTACT_T / CT-) ================= */}
      {activeTab === 'CONTACT_T' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-400" />
                <span>聯繫紀錄 (CONTACT_T) · 表格結構驗證</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                格式：<code className="text-sky-300 font-mono">headers: ["ID", "狀態", "姓名", "聯繫日期", "聯繫方式", "洽談內容", "下一步計畫", "照片連結", "更新時間"]</code> · <span className="text-amber-400 font-mono">imgIdx: 7 (第 7 欄位為照片連結)</span>
              </p>
            </div>
            <div className="text-xs font-mono text-sky-300 bg-sky-950/80 px-2.5 py-1 rounded border border-sky-800">
              共 {filteredTrackings.length} 筆聯繫紀錄
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">ID (前綴 CT-)</th>
                  <th className="py-2.5 px-3">狀態</th>
                  <th className="py-2.5 px-3">照片 (imgIdx: 7)</th>
                  <th className="py-2.5 px-3">姓名</th>
                  <th className="py-2.5 px-3">聯繫日期</th>
                  <th className="py-2.5 px-3">聯繫方式</th>
                  <th className="py-2.5 px-3">洽談內容</th>
                  <th className="py-2.5 px-3">下一步計畫</th>
                  <th className="py-2.5 px-3">更新時間</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredTrackings.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-sky-400">{t.id}</td>
                    <td className="py-2.5 px-3 font-sans">
                      <span className={`px-2 py-0.5 rounded text-[11px] ${
                        t.status === '開通體驗'
                          ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                          : t.status === '已完成'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {t.photoUrl && !brokenImages[t.id] ? (
                        <img
                          src={t.photoUrl}
                          alt={t.name}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-full object-cover border border-slate-700 shadow-sm"
                          onError={() => setBrokenImages((prev) => ({ ...prev, [t.id]: true }))}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-sky-950 border border-sky-800 flex items-center justify-center text-xs font-bold text-sky-300 font-sans">
                          {t.name.slice(0, 1)}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-sans font-bold text-slate-200">{t.name}</td>
                    <td className="py-2.5 px-3 text-slate-300">{t.contactDate}</td>
                    <td className="py-2.5 px-3 font-sans text-sky-400 font-medium">{t.contactMethod}</td>
                    <td className="py-2.5 px-3 font-sans text-slate-300 max-w-sm" title={t.discussionContent}>
                      {t.discussionContent}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-amber-300 max-w-xs" title={t.nextStepPlan}>
                      {t.nextStepPlan}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                      {new Date(t.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 3: 活動主檔 (EVENT_M / EM-) ================= */}
      {activeTab === 'EVENT_M' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>活動主檔 (EVENT_M) · 表格結構驗證</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                格式：<code className="text-amber-300 font-mono">headers: ["ID", "狀態", "活動主題", "日期", "地點", "預算", "負責人", "備註", "照片連結", "更新時間"]</code> · <span className="text-amber-400 font-mono">imgIdx: 8 (照片連結)</span>
              </p>
            </div>
            <div className="text-xs font-mono text-amber-300 bg-amber-950/80 px-2.5 py-1 rounded border border-amber-800">
              共 {filteredEvents.length} 場次活動
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredEvents.map((e) => (
              <div
                key={e.id}
                className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden hover:border-amber-700/60 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-40 w-full overflow-hidden bg-slate-900 flex items-center justify-center">
                    {e.photoUrl && !brokenImages[e.id] ? (
                      <img
                        src={e.photoUrl}
                        alt={e.eventTheme}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={() => setBrokenImages((prev) => ({ ...prev, [e.id]: true }))}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-600 gap-1.5">
                        <Calendar className="w-8 h-8 text-amber-500/40" />
                        <span className="text-[11px] font-mono">{e.id}</span>
                      </div>
                    )}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-950/80 backdrop-blur-md text-amber-300 font-mono text-xs font-bold border border-amber-800/80">
                        {e.id}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-950/80 backdrop-blur-md text-emerald-300 text-xs font-medium border border-emerald-800/80">
                        {e.status}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 space-y-2.5">
                    <h4 className="text-sm font-bold text-slate-100">{e.eventTheme}</h4>
                    <div className="space-y-1.5 text-xs text-slate-400">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="font-mono text-slate-200">{e.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span className="text-slate-300">{e.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span>負責人：<strong className="text-slate-200">{e.leader}</strong></span>
                        <span className="text-slate-600">·</span>
                        <span>預算：<span className="font-mono text-amber-400">${Number(e.budget).toLocaleString()} 元</span></span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-slate-900 rounded-lg text-xs text-slate-300 leading-relaxed border border-slate-800/60">
                      {e.notes || '新人 1+1 開通軟體實機操演與閉環 100 點分潤平帳。'}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-900/60 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span>已報名：<strong className="font-mono text-emerald-300">{e.participantsCount || 48} 人</strong></span>
                  <span className="text-[11px] font-mono text-slate-500">更新於 {new Date(e.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 4: 活動花絮 (EVENT_T / ET-) ================= */}
      {activeTab === 'EVENT_T' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span>活動花絮 (EVENT_T) · 表格結構驗證</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                格式：<code className="text-amber-300 font-mono">headers: ["ID", "狀態", "活動主題", "照片標題", "拍攝地點", "內容備註", "照片連結", "更新時間"]</code> · <span className="text-amber-400 font-mono">imgIdx: 6 (照片連結)</span>
              </p>
            </div>
            <div className="text-xs font-mono text-amber-300 bg-amber-950/80 px-2.5 py-1 rounded border border-amber-800">
              共 {filteredHighlights.length} 篇活動剪影花絮
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredHighlights.map((h) => (
              <div
                key={h.id}
                className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden hover:border-amber-700/60 transition-colors"
              >
                <div className="relative h-48 w-full overflow-hidden bg-slate-900 flex items-center justify-center">
                  {h.photoUrl && !brokenImages[h.id] ? (
                    <img
                      src={h.photoUrl}
                      alt={h.photoTitle}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      onError={() => setBrokenImages((prev) => ({ ...prev, [h.id]: true }))}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-600 gap-1.5">
                      <ImageIcon className="w-8 h-8 text-amber-500/40" />
                      <span className="text-[11px] font-mono">{h.id}</span>
                    </div>
                  )}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-950/80 backdrop-blur-md text-amber-300 font-mono text-xs font-bold border border-amber-800/80">
                      {h.id}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-950/80 backdrop-blur-md text-amber-300 text-[10px] font-medium border border-amber-800/80">
                      {h.status}
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  <h4 className="text-sm font-bold text-slate-100">{h.photoTitle}</h4>
                  <div className="text-xs text-indigo-400 font-medium">{h.eventTheme}</div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>{h.shootLocation}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed pt-1">
                    {h.contentNotes}
                  </p>
                  <div className="pt-2 text-[10px] text-slate-500 font-mono">
                    更新時間: {new Date(h.updatedAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= MODAL: 新增通訊主檔 ================= */}
      {isNewContactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Contact className="w-4 h-4 text-sky-400" />
                <span>新增通訊主檔 (CONTACT_M / CM-)</span>
              </h3>
              <button onClick={() => setIsNewContactModalOpen(false)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>

            <form onSubmit={handleCreateContact} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">姓名 (Name)</label>
                <input
                  type="text"
                  required
                  placeholder="例如：陳雅婷"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">手機 (Mobile Phone)</label>
                  <input
                    type="text"
                    required
                    placeholder="0912-345-678"
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">市內電話 (Telephone)</label>
                  <input
                    type="text"
                    placeholder="02-2345-6789"
                    value={newContactTel}
                    onChange={(e) => setNewContactTel(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Line ID</label>
                  <input
                    type="text"
                    placeholder="例如：yating_chen"
                    value={newContactLine}
                    onChange={(e) => setNewContactLine(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="yating@example.com"
                    value={newContactEmail}
                    onChange={(e) => setNewContactEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">通訊地址</label>
                <input
                  type="text"
                  placeholder="台北市信義區信義路五段..."
                  value={newContactAddress}
                  onChange={(e) => setNewContactAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">照片連結 (imgIdx: 8)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={newContactPhoto}
                  onChange={(e) => setNewContactPhoto(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewContactModalOpen(false)}
                  className="px-3.5 py-1.5 text-slate-400 hover:text-slate-200"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg shadow-sm"
                >
                  確認建立 CM- 通訊檔
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: 新增聯繫紀錄 ================= */}
      {isNewTrackingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-400" />
                <span>新增聯繫紀錄 (CONTACT_T / CT-)</span>
              </h3>
              <button onClick={() => setIsNewTrackingModalOpen(false)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>

            <form onSubmit={handleCreateTracking} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">聯繫會員姓名</label>
                  <input
                    type="text"
                    required
                    value={newTrackingName}
                    onChange={(e) => setNewTrackingName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">聯繫日期</label>
                  <input
                    type="date"
                    required
                    value={newTrackingDate}
                    onChange={(e) => setNewTrackingDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">聯繫方式</label>
                  <select
                    value={newTrackingMethod}
                    onChange={(e) => setNewTrackingMethod(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500 cursor-pointer"
                  >
                    <option value="線上開通">線上開通</option>
                    <option value="Line">Line 聯繫</option>
                    <option value="電話">電話訪問</option>
                    <option value="面談">實體面談</option>
                    <option value="視訊">視訊會議</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">狀態</label>
                  <select
                    value={newTrackingStatus}
                    onChange={(e) => setNewTrackingStatus(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500 cursor-pointer"
                  >
                    <option value="已完成">已完成</option>
                    <option value="待跟進">待跟進</option>
                    <option value="開通體驗">開通體驗</option>
                    <option value="預約活動">預約活動</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">洽談內容 (Discussion)</label>
                <textarea
                  rows={3}
                  required
                  placeholder="紀錄會員對於 AI 軟體 1+1 體驗反饋、雙軌卡位理解等..."
                  value={newTrackingDiscussion}
                  onChange={(e) => setNewTrackingDiscussion(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">下一步計畫 (Next Step)</label>
                <input
                  type="text"
                  required
                  placeholder="例如：邀約參加週三台北實體啟航說明會"
                  value={newTrackingNextPlan}
                  onChange={(e) => setNewTrackingNextPlan(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">照片連結 (imgIdx: 7)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={newTrackingPhoto}
                  onChange={(e) => setNewTrackingPhoto(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewTrackingModalOpen(false)}
                  className="px-3.5 py-1.5 text-slate-400 hover:text-slate-200"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg shadow-sm"
                >
                  寫入 CT- 聯繫紀錄
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: 發布新活動 ================= */}
      {isNewEventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>發布新活動 (EVENT_M / EM-)</span>
              </h3>
              <button onClick={() => setIsNewEventModalOpen(false)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">活動主題 (Theme)</label>
                <input
                  type="text"
                  required
                  placeholder="例如：新會員開通 AI 軟體 1+1 高雄實體戰略說明會"
                  value={newEventTheme}
                  onChange={(e) => setNewEventTheme(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">活動日期</label>
                  <input
                    type="date"
                    required
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">活動預算 (NTD)</label>
                  <input
                    type="number"
                    value={newEventBudget}
                    onChange={(e) => setNewEventBudget(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">活動地點</label>
                <input
                  type="text"
                  required
                  placeholder="高雄巨蛋國際創富教育中心 (EDU-KAOHSIUNG-01)"
                  value={newEventLocation}
                  onChange={(e) => setNewEventLocation(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">活動負責人</label>
                <input
                  type="text"
                  required
                  placeholder="例如：黃柏翰 (A-00006)"
                  value={newEventLeader}
                  onChange={(e) => setNewEventLeader(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">備註說明</label>
                <input
                  type="text"
                  placeholder="含 AI 軟體 1+1 實體操演與 100 點平帳精闢拆解"
                  value={newEventNotes}
                  onChange={(e) => setNewEventNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">照片連結 (imgIdx: 8, 活動主視覺海報)</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={newEventPhoto}
                  onChange={(e) => setNewEventPhoto(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewEventModalOpen(false)}
                  className="px-3.5 py-1.5 text-slate-400 hover:text-slate-200"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg shadow-sm"
                >
                  發布 EM- 活動主檔
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: 上傳活動花絮 ================= */}
      {isNewHighlightModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span>上傳活動花絮 (EVENT_T / ET-)</span>
              </h3>
              <button onClick={() => setIsNewHighlightModalOpen(false)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>

            <form onSubmit={handleCreateHighlight} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">活動主題 (對應活動主檔)</label>
                <input
                  type="text"
                  required
                  placeholder="例如：新會員開通 AI 軟體 1+1 實體啟航說明會"
                  value={newHighlightTheme}
                  onChange={(e) => setNewHighlightTheme(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">照片標題 (Photo Title)</label>
                <input
                  type="text"
                  required
                  placeholder="例如：全員成功開通單軌公排與雙軌卡位大合照"
                  value={newHighlightTitle}
                  onChange={(e) => setNewHighlightTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">拍攝地點</label>
                <input
                  type="text"
                  placeholder="例如：台北國際教育培訓中心 演講大廳"
                  value={newHighlightLocation}
                  onChange={(e) => setNewHighlightLocation(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">內容備註 (Notes)</label>
                <textarea
                  rows={2}
                  placeholder="紀錄活動亮點與會員滿意度..."
                  value={newHighlightNotes}
                  onChange={(e) => setNewHighlightNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">照片連結 (imgIdx: 6, 高清圖片網址)</label>
                <input
                  type="url"
                  required
                  placeholder="https://images.unsplash.com/photo-..."
                  value={newHighlightPhoto}
                  onChange={(e) => setNewHighlightPhoto(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewHighlightModalOpen(false)}
                  className="px-3.5 py-1.5 text-slate-400 hover:text-slate-200"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg shadow-sm"
                >
                  發布 ET- 活動花絮
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
