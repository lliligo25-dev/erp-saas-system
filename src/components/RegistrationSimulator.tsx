/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { erpEngine, GLOBAL_BOUNDARIES } from '../services/erpEngine';
import {
  Member,
  NodeRecord,
  ContactMasterRecord,
  ContactTrackingRecord,
  BookingProfile
} from '../types/erp';
import { 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Play, 
  Contact,
  FileText,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  Calendar,
  CalendarClock,
  Layers,
  GitFork
} from 'lucide-react';

interface RegistrationSimulatorProps {
  prefillClient?: { name: string; phone: string; line?: string; sponsorMid?: string } | null;
  lockedSponsorMid?: string;
  scopedMemberMode?: boolean;
  onNodeCreated: () => void;
  onNavigateToTree: (nodeId?: string) => void;
  onNavigateToMonoline: () => void;
  onNavigateToMemberNodes?: (mid: string) => void;
  onNavigateToCrmEvents?: () => void;
  onNavigateToMemberPortal?: (mid: string) => void;
}

export const RegistrationSimulator: React.FC<RegistrationSimulatorProps> = ({
  prefillClient,
  lockedSponsorMid,
  scopedMemberMode = false,
  onNodeCreated,
  onNavigateToTree,
  onNavigateToMonoline,
  onNavigateToMemberNodes,
  onNavigateToCrmEvents,
  onNavigateToMemberPortal,
}) => {
  // Member & CRM Contact Fields (Formal Blank Form by Default — Mapped to CONTACT_M & CONTACT_T)
  const [name, setName] = useState(prefillClient?.name || '');
  const [phone, setPhone] = useState(prefillClient?.phone || '');
  const [tel, setTel] = useState('');
  const [line, setLine] = useState(prefillClient?.line || '');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [idNumberMasked, setIdNumberMasked] = useState('');

  // Hierarchy bindings
  const [sponsorMid, setSponsorMid] = useState(
    lockedSponsorMid || prefillClient?.sponsorMid || GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID
  );
  const [storeId, setStoreId] = useState('S-TAIPEI-01');
  const [centerId, setCenterId] = useState('EDU-GLOBAL-01');
  const [activateBookingSystem, setActivateBookingSystem] = useState(true);

  useEffect(() => {
    if (prefillClient) {
      setName(prefillClient.name);
      setPhone(prefillClient.phone);
      if (prefillClient.line) setLine(prefillClient.line);
      if (!lockedSponsorMid && prefillClient.sponsorMid) {
        setSponsorMid(prefillClient.sponsorMid);
      }
    }
  }, [prefillClient, lockedSponsorMid]);

  useEffect(() => {
    if (lockedSponsorMid) {
      setSponsorMid(lockedSponsorMid);
    }
  }, [lockedSponsorMid]);

  // Tracking fields (Mapped to CONTACT_T; optional blank by default)
  const [discussionContent, setDiscussionContent] = useState('');
  const [nextStepPlan, setNextStepPlan] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{
    member: Member;
    monolineNode: NodeRecord;
    binaryNode: NodeRecord;
    contact?: ContactMasterRecord;
    contactTracking?: ContactTrackingRecord;
    bookingProfile?: BookingProfile;
    message: string;
  } | null>(null);

  const [batchCount, setBatchCount] = useState<number>(5);
  const [batchRunning, setBatchRunning] = useState(false);

  const sampleNames = [
    '陳雅婷', '林志豪', '張淑芬', '黃冠宇', '李美玲', 
    '吳宗憲', '劉怡君', '蔡家豪', '楊佩君', '許家瑋',
    '鄭雅芳', '謝建國', '洪鈺涵', '郭承翰', '曾靜怡'
  ];

  const handleClearForm = () => {
    setName('');
    setPhone('');
    setTel('');
    setLine('');
    setEmail('');
    setAddress('');
    setPhotoUrl('');
    setIdNumberMasked('');
    setDiscussionContent('');
    setNextStepPlan('');
  };

  const handleFillTestSample = () => {
    const randomName = sampleNames[Math.floor(Math.random() * sampleNames.length)];
    const rand8 = Math.floor(10000000 + Math.random() * 90000000);
    setName(randomName);
    setPhone(`09${rand8}`);
    setTel(`02-${Math.floor(20000000 + Math.random() * 70000000)}`);
    setLine(`demo_${rand8.toString().slice(0, 4)}`);
    setEmail(`demo${rand8.toString().slice(0, 4)}@example.com`);
    setAddress('台北市大安區忠孝東路四段 128 號');
    setPhotoUrl('');
    setIdNumberMasked(`A1${rand8.toString().slice(0, 3)}***${rand8.toString().slice(5, 8)}`);
    setDiscussionContent('測試開通 AI 軟體 1+1 與 30 天免費體驗。');
    setNextStepPlan('引導登入個人工作台並測試試算表同步。');
  };

  const handleSingleRegister = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    setIsSubmitting(true);
    setTimeout(() => {
      const res = erpEngine.registerNewMember({
        name: name.trim(),
        phone: phone.trim(),
        tel: tel.trim(),
        line: line.trim(),
        email: email.trim(),
        address: address.trim(),
        photoUrl: photoUrl.trim(),
        idNumberMasked: idNumberMasked.trim(),
        sponsorMid: (lockedSponsorMid || sponsorMid).trim(),
        storeId: storeId.trim(),
        centerId: centerId.trim(),
        discussionContent: discussionContent.trim(),
        nextStepPlan: nextStepPlan.trim(),
        activateBookingSystem,
      });

      setLastResult(res);
      setIsSubmitting(false);
      onNodeCreated();

      // 開通完成後恢復正式空白表單，避免誤把上一位或測試資料再次送出
      handleClearForm();
    }, 150);
  };

  const handleBatchRegister = async (count: number) => {
    setBatchRunning(true);
    for (let i = 0; i < count; i++) {
      const randomName = sampleNames[i % sampleNames.length] + `_${Math.floor(Math.random() * 900 + 100)}`;
      const res = erpEngine.registerNewMember({
        name: randomName,
        phone: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
        idNumberMasked: `B1${Math.floor(10000000 + Math.random() * 90000000).toString().substring(0, 3)}***`,
        sponsorMid: sponsorMid.trim(),
        storeId,
        centerId,
        discussionContent: `批次開通第 ${i + 1} 位會員 AI 軟體 1+1 體驗`,
        nextStepPlan: '邀約參加近期線上新人說明會',
        activateBookingSystem,
      });
      setLastResult(res);
      onNodeCreated();
      // Brief delay for visual satisfaction
      await new Promise((r) => setTimeout(r, 60));
    }
    setBatchRunning(false);
  };

  const allMembers = erpEngine.getAllMembers();
  const membersList = scopedMemberMode && lockedSponsorMid
    ? allMembers.filter((m) => m.sponsorMid === lockedSponsorMid).slice(0, 15)
    : allMembers.slice(0, 15);

  return (
    <div className="space-y-8">
      {/* Introduction banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="text-indigo-300 font-semibold">1+1 雙發路由引擎</span>
              <span aria-hidden="true">·</span>
              <span className="text-sky-300">第 3 種 AI 個人預約系統連動</span>
            </div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 mt-1.5">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <span>{scopedMemberMode ? '推薦新夥伴開通 AI 軟體 1+1（通訊錄 CRM + 活動行銷）' : '新會員開通 AI 軟體 1+1（通訊錄 CRM + 活動行銷）'}</span>
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-3xl leading-relaxed">
              當新會員完成開通時，系統於同一筆事務內自動開啟 2 套核心 AI 軟體 30 天免費體驗（<strong className="text-teal-300">第 1 套：通訊錄 CRM</strong>、<strong className="text-blue-300">第 2 套：活動行銷</strong>），同步綁定單軌公排與雙軌二元樹節點，並可免費加開<strong className="text-sky-400">第 3 種 AI 個人預約系統</strong>（30 天免費體驗 · 月租 100 元）。
            </p>
          </div>

          {!scopedMemberMode && (
            <div className="flex items-center gap-2">
              {onNavigateToCrmEvents && (
                <button
                  onClick={onNavigateToCrmEvents}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Contact className="w-4 h-4 text-sky-400" />
                  <span>檢視通訊錄與活動中心 (CM/CT/EM/ET) →</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Form & Realtime Simulation Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Input Form */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>填寫開通資料 (正式空白表單)</span>
              </h3>
              <div className="flex items-center gap-1.5">
                {!scopedMemberMode && (
                  <button
                    type="button"
                    onClick={handleFillTestSample}
                    className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-semibold text-amber-300 cursor-pointer transition-colors"
                  >
                    帶入測試範例
                  </button>
                )}
                {(name || phone || tel || line || email || address || idNumberMasked) && (
                  <button
                    type="button"
                    onClick={handleClearForm}
                    className="px-2.5 py-1 rounded-md bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] font-semibold text-slate-400 hover:text-slate-200 cursor-pointer transition-colors"
                  >
                    清空
                  </button>
                )}
              </div>
            </div>

            <form onSubmit={handleSingleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    會員姓名 (Name) *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-medium"
                    placeholder="請輸入姓名"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    身分證號 (去識別)
                  </label>
                  <input
                    type="text"
                    value={idNumberMasked}
                    onChange={(e) => setIdNumberMasked(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 focus:outline-none focus:border-indigo-500"
                    placeholder="A123***789"
                  />
                </div>
              </div>

              {/* Contact Fields for CONTACT_M */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    手機號碼 (Mobile) *
                  </label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                    placeholder="0912-345-678"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    市話 / 公司電話
                  </label>
                  <input
                    type="text"
                    value={tel}
                    onChange={(e) => setTel(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                    placeholder="02-2771-9900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Line ID
                  </label>
                  <input
                    type="text"
                    value={line}
                    onChange={(e) => setLine(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-emerald-400 focus:outline-none focus:border-indigo-500 font-mono"
                    placeholder="wang_daming"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    placeholder="daming@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  通訊地址 (Address)
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  placeholder="台北市大安區忠孝東路四段 128 號 12 樓"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  個人照片網址 (imgIdx: 8, 頭像/名片連結)
                </label>
                <input
                  type="url"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none focus:border-indigo-500"
                  placeholder="https://drive.google.com/thumbnail?sz=w800&id=1hhnvavFgkxXJuC6ECYWiPV9Ir1NWO4NJ"
                />
              </div>

              {/* Hierarchy */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  直推推薦人 MID (Sponsor MID)
                </label>
                <input
                  type="text"
                  value={lockedSponsorMid || sponsorMid}
                  disabled={Boolean(lockedSponsorMid)}
                  onChange={(e) => setSponsorMid(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-indigo-300 focus:outline-none focus:border-indigo-500 disabled:opacity-70"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  {lockedSponsorMid
                    ? `已鎖定為您的直推推薦碼 (${lockedSponsorMid})`
                    : '預設為公司自營對外直推首席 A-00008'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    綁定經營店 (Store)
                  </label>
                  <input
                    type="text"
                    value={storeId}
                    onChange={(e) => setStoreId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    教育中心 (Center)
                  </label>
                  <input
                    type="text"
                    value={centerId}
                    onChange={(e) => setCenterId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* 3rd AI System Activation Toggle */}
              <label className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-950 border border-sky-900/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activateBookingSystem}
                  onChange={(e) => setActivateBookingSystem(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0"
                />
                <div className="text-xs">
                  <div className="font-semibold text-sky-300 flex items-center gap-1.5">
                    <CalendarClock className="w-3.5 h-3.5" />
                    <span>同步開通第 3 種 AI 系統：個人預約系統</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    核發專屬 BK- 授權碼，享 30 天免費體驗 · 期滿月租 100 元
                  </div>
                </div>
              </label>

              {/* CRM Contact Tracking initial fields */}
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
                <div className="text-[11px] font-bold text-sky-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>首筆聯繫紀錄預設 (寫入 CONTACT_T / CT-)</span>
                </div>
                <div>
                  <input
                    type="text"
                    value={discussionContent}
                    onChange={(e) => setDiscussionContent(e.target.value)}
                    placeholder="洽談內容..."
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={nextStepPlan}
                    onChange={(e) => setNextStepPlan(e.target.value)}
                    placeholder="下一步追蹤計畫..."
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || batchRunning}
                className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 via-sky-600 to-teal-600 hover:from-indigo-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isSubmitting ? '開通 AI 軟體 1+1 雙發路由中...' : '⚡ 立即開通新會員 AI 軟體 1+1 (同步建立 CM/CT)'}</span>
              </button>
            </form>
          </div>

          {/* Batch simulation module (Hidden in scopedMemberMode) */}
          {!scopedMemberMode && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-400" />
                <span>批次壓力開通模擬 (Batch AI Activation)</span>
              </h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                連續為多筆新會員開通 AI 軟體 1+1，即時觀測雙軌二元樹 BFS 智慧由上至下、由左至右自動滑落與填補空位的過程。
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleBatchRegister(5)}
                  disabled={batchRunning}
                  className="flex-1 py-2 px-3 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                >
                  模擬 +5 人
                </button>
                <button
                  type="button"
                  onClick={() => handleBatchRegister(10)}
                  disabled={batchRunning}
                  className="flex-1 py-2 px-3 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                >
                  模擬 +10 人
                </button>
                <button
                  type="button"
                  onClick={() => handleBatchRegister(25)}
                  disabled={batchRunning}
                  className="flex-1 py-2 px-3 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                >
                  模擬 +25 人
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Dual Node Dispatch Realtime Receipt & Member Ledger */}
        <div className="lg:col-span-7 space-y-6">
          {/* Latest 1+1 Transaction Receipt & Certificate */}
          {lastResult && (
            <div className="bg-gradient-to-b from-indigo-950/50 via-slate-900 to-slate-900 border border-indigo-500/50 rounded-xl p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-indigo-900/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-600/30 border border-emerald-500 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-100 uppercase tracking-wider block">
                      新會員開通 AI 軟體 1+1 成功憑證
                    </span>
                    <span className="text-[11px] text-slate-400 font-sans">
                      雙發卡位完成 · 通訊主檔與聯繫日誌已同步入庫
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-950 px-2.5 py-1 rounded border border-indigo-800">
                    會員 MID: {lastResult.member.mid}
                  </span>
                </div>
              </div>

              {/* 2 Software Activation Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Software 1 Result: 通訊錄 CRM */}
                <div className="bg-slate-950/80 border border-teal-800/60 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-teal-400 uppercase flex items-center gap-1.5">
                      <Layers className="w-4 h-4" />
                      第 1 套 AI 軟體 · 通訊錄 CRM
                    </span>
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono font-bold">
                      <Clock className="w-3 h-3" />
                      30 天體驗
                    </span>
                  </div>
                  <div className="text-lg font-black text-slate-100 font-mono">
                    {lastResult.contact?.id || 'CM-已開通'} / {lastResult.monolineNode.nodeId}
                  </div>
                  <div className="text-xs text-slate-400 space-y-1 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/60">
                    <div>
                      <span>開通模組：</span>
                      <span className="text-teal-300 font-semibold ml-1">通訊主檔 (CM-) + 聯繫追蹤 (CT-)</span>
                    </div>
                    <div>
                      <span>綁定單軌公排節點：</span>
                      <span className="font-mono text-slate-200 ml-1">{lastResult.monolineNode.nodeId} (第 {lastResult.monolineNode.depth} 席)</span>
                    </div>
                    <div>
                      <span>互助權益：</span>
                      <span className="text-emerald-400 ml-1">向上享 15 代公排互助</span>
                    </div>
                  </div>
                  {!scopedMemberMode && (
                    <button
                      onClick={onNavigateToMonoline}
                      className="w-full mt-2 text-center py-1.5 bg-teal-950 hover:bg-teal-900 text-teal-300 border border-teal-800/80 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                    >
                      在單軌公排中檢視 →
                    </button>
                  )}
                </div>

                {/* Software 2 Result: 活動行銷 */}
                <div className="bg-slate-950/80 border border-blue-800/60 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-400 uppercase flex items-center gap-1.5">
                      <GitFork className="w-4 h-4" />
                      第 2 套 AI 軟體 · 活動行銷
                    </span>
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono font-bold">
                      <Clock className="w-3 h-3" />
                      30 天體驗
                    </span>
                  </div>
                  <div className="text-lg font-black text-slate-100 font-mono">
                    EM/ET 已開通 / {lastResult.binaryNode.nodeId}
                  </div>
                  <div className="text-xs text-slate-400 space-y-1 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/60">
                    <div>
                      <span>開通模組：</span>
                      <span className="text-blue-300 font-semibold ml-1">活動企劃檔 (EM-) + 活動花絮 (ET-)</span>
                    </div>
                    <div>
                      <span>綁定雙軌節點：</span>
                      <span className="font-mono text-amber-300 font-bold ml-1">
                        {lastResult.binaryNode.placementPosition === 'L' ? '左區 (L)' : '右區 (R)'}
                      </span>
                      <span className="text-slate-400 ml-1">(Depth {lastResult.binaryNode.depth} · 父 {lastResult.binaryNode.parentId})</span>
                    </div>
                    <div>
                      <span>定海神針頂點：</span>
                      <span className="font-mono text-indigo-300 ml-1">C-25000001</span>
                    </div>
                  </div>
                  {!scopedMemberMode && (
                    <button
                      onClick={() => onNavigateToTree(lastResult.binaryNode.nodeId)}
                      className="w-full mt-2 text-center py-1.5 bg-blue-950 hover:bg-blue-900 text-blue-300 border border-blue-800/80 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                    >
                      在雙軌二元樹中檢視 →
                    </button>
                  )}
                </div>
              </div>

              {/* 3rd AI Personal Booking Activation Badge */}
              {lastResult.bookingProfile && (
                <div className="bg-slate-950 p-3.5 rounded-xl border border-sky-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-sky-400 shrink-0" />
                    <span className="font-semibold text-sky-300">
                      第 3 種 AI 個人預約系統已開通：{lastResult.bookingProfile.licenseId}
                    </span>
                  </div>
                  <span className="font-mono text-emerald-400">
                    30 天免費體驗 · 期滿月租 100 元
                  </span>
                </div>
              )}

              {/* Synchronized CRM Records Badge */}
              <div className="bg-slate-950 p-4 rounded-xl border border-sky-900/40 space-y-3">
                <div className="flex items-center justify-between text-xs border-b border-slate-800/80 pb-2">
                  <span className="font-bold text-sky-400 flex items-center gap-1.5">
                    <Contact className="w-4 h-4" />
                    Google Sheets CRM 自動連動建檔結果
                  </span>
                  {!scopedMemberMode && onNavigateToCrmEvents && (
                    <button
                      onClick={onNavigateToCrmEvents}
                      className="text-sky-400 hover:text-sky-300 underline font-medium cursor-pointer"
                    >
                      前往通訊錄與活動中心 →
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <div className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>通訊主檔 (CONTACT_M)</span>
                      <span className="font-mono font-bold text-sky-300">{lastResult.contact?.id || 'CM-自動編配'}</span>
                    </div>
                    <div className="text-slate-200 mt-1 font-semibold">{lastResult.member.name}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      手機: <span className="font-mono text-slate-300">{lastResult.member.phone}</span> · Line: <span className="font-mono text-emerald-400">{lastResult.member.line}</span>
                    </div>
                  </div>

                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <div className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>首筆聯繫紀錄 (CONTACT_T)</span>
                      <span className="font-mono font-bold text-sky-300">{lastResult.contactTracking?.id || 'CT-自動編配'}</span>
                    </div>
                    <div className="text-slate-200 mt-1 font-semibold">方式: 線上開通 · 狀態: 開通體驗</div>
                    <div className="text-[11px] text-amber-300/90 mt-0.5 line-clamp-1">
                      計畫: {lastResult.contactTracking?.nextStepPlan}
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-400 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                <span className="text-slate-200 font-semibold">系統回報：</span> {lastResult.message}
              </div>

              {!scopedMemberMode && (
                <div className="flex flex-col sm:flex-row gap-2">
                  {onNavigateToMemberNodes && (
                    <button
                      onClick={() => onNavigateToMemberNodes(lastResult.member.mid)}
                      className="flex-1 py-2 px-3 bg-indigo-900/60 hover:bg-indigo-900 border border-indigo-700/80 text-indigo-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                    >
                      <span>節點全貌報告 →</span>
                    </button>
                  )}
                  {onNavigateToMemberPortal && (
                    <button
                      onClick={() => onNavigateToMemberPortal(lastResult.member.mid)}
                      className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                    >
                      <span>登入【{lastResult.member.name}】個人戰情室 →</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Members Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                  <span>{scopedMemberMode ? '我直推開通的夥伴名單' : '最近開通 AI 軟體 1+1 會員名單'}</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  所有會員均同時持有第 1 組單軌公排節點與第 2 組雙軌二元樹卡位節點。
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                {scopedMemberMode ? `本人直推 ${membersList.length} 人` : `累計開通 ${erpEngine.getAllMembers().length} 人`}
              </span>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">會員 MID (A-碼)</th>
                    <th className="py-2.5 px-3">姓名</th>
                    <th className="py-2.5 px-3">第1組單軌 (C-碼)</th>
                    <th className="py-2.5 px-3">第2組雙軌 (C-碼)</th>
                    <th className="py-2.5 px-3">推薦人 MID</th>
                    <th className="py-2.5 px-3">通訊 CM-</th>
                    <th className="py-2.5 px-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {membersList.map((m) => (
                    <tr key={m.mid} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-indigo-300">
                        {m.mid}
                      </td>
                      <td className="py-2.5 px-3 font-sans font-medium text-slate-200">
                        {m.name}
                      </td>
                      <td className="py-2.5 px-3 text-teal-400">
                        {m.monolineNodeId}
                      </td>
                      <td className="py-2.5 px-3 text-blue-400">
                        {m.binaryNodeId}
                      </td>
                      <td className="py-2.5 px-3 text-purple-300">
                        {m.sponsorMid}
                      </td>
                      <td className="py-2.5 px-3 text-sky-400">
                        {m.contactId || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-sans whitespace-nowrap space-x-2">
                        {!scopedMemberMode ? (
                          <>
                            {onNavigateToMemberPortal && (
                              <button
                                onClick={() => onNavigateToMemberPortal(m.mid)}
                                className="text-xs text-sky-400 hover:text-sky-300 font-medium cursor-pointer"
                              >
                                登入戰情室
                              </button>
                            )}
                            {onNavigateToMemberNodes && (
                              <button
                                onClick={() => onNavigateToMemberNodes(m.mid)}
                                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                              >
                                節點 →
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-[11px] text-emerald-400">已開通</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
