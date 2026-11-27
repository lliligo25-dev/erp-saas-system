/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useState, useEffect } from 'react';
import { erpEngine } from './services/erpEngine';
import {
  apiGetSession,
  apiLogout,
  apiQrLogin,
  ScopedBootstrapPayload,
} from './services/confidentialApiClient';
import { AuthSession, SystemStats, UserRole } from './types/erp';
import { Header, NavItem } from './components/Header';
import { RoleLoginPortal } from './components/RoleLoginPortal';
import { PublicJoinFormView } from './components/PublicJoinFormView';
import { RegistrationSimulator } from './components/RegistrationSimulator';
import { MemberNodesView } from './components/MemberNodesView';
import { StorePortalView } from './components/StorePortalView';
import { CenterPortalView } from './components/CenterPortalView';
import { CrmEventsView } from './components/CrmEventsView';
import { MemberPortalView } from './components/MemberPortalView';
import { BookingSystemView } from './components/BookingSystemView';
import { MemberFiveStarWorkspace } from './components/MemberFiveStarWorkspace';
import { SoftwareOrderSystemView } from './components/SoftwareOrderSystemView';
import { ViewportToolbar, ViewportMode } from './components/ViewportToolbar';
import {
  PublicShareDeployModal,
  ShareDeployModalTab,
} from './components/PublicShareDeployModal';
import {
  FontPreferences,
  FONT_UPDATED_EVENT,
  loadFontPreferences,
  saveFontPreferences,
  applyFontPreferencesToDocument,
} from './services/fontPreferences';
import {
  parsePortalFromUrl,
  detectLineInAppBrowser,
  detectMobileUserAgent,
} from './services/rolePortalUrlService';
import { LineInAppBanner } from './components/LineInAppBanner';
import { MobileSettingsDrawer } from './components/MobileSettingsDrawer';
import { MobileDeviceShell, MobilePhonePreset } from './components/MobileDeviceShell';
import welcomeSplashImg from './assets/images/welcome_splash_1795778610216.jpg';
import { Search, RotateCcw, ShieldCheck, Menu } from 'lucide-react';

// 方案 B 保密原則：總部機密儀表板、閉環清算器、全網樹圖與 GAS/MySQL 程式碼僅動態延遲載入，
// 一般會員、營業店、教育中心與未登入訪客的瀏覽器永遠不會下載到總部模組程式碼。
const OverviewView = lazy(() =>
  import('./components/OverviewView').then((m) => ({ default: m.OverviewView }))
);
const DualTreeVisualizer = lazy(() =>
  import('./components/DualTreeVisualizer').then((m) => ({ default: m.DualTreeVisualizer }))
);
const MonolineQueueView = lazy(() =>
  import('./components/MonolineQueueView').then((m) => ({ default: m.MonolineQueueView }))
);
const SettlementCalculator = lazy(() =>
  import('./components/SettlementCalculator').then((m) => ({ default: m.SettlementCalculator }))
);
const GasCodeAndApiView = lazy(() =>
  import('./components/GasCodeAndApiView').then((m) => ({ default: m.GasCodeAndApiView }))
);
const MemberLookupModal = lazy(() =>
  import('./components/MemberLookupModal').then((m) => ({ default: m.MemberLookupModal }))
);
const HqDatabaseAdminView = lazy(() =>
  import('./components/HqDatabaseAdminView').then((m) => ({ default: m.HqDatabaseAdminView }))
);

const VIEWPORT_MODE_STORAGE_KEY = 'ais_viewport_mode';
const MOBILE_PRESET_STORAGE_KEY = 'ais_mobile_phone_preset';

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  HQ_STAFF: [
    { id: 'overview', label: '總部總覽' },
    {
      id: 'registration',
      label: '開通與預約',
      matchTabs: ['booking_system', 'software_order', 'member_nodes', 'member_portal'],
    },
    {
      id: 'tree_explorer',
      label: '雙軌與單軌',
      matchTabs: ['binary_tree', 'monoline'],
    },
    {
      id: 'settlement',
      label: '閉環與門店',
      matchTabs: ['store_portal', 'center_portal'],
    },
    {
      id: 'hq_db_admin',
      label: '資料庫與 GAS',
      matchTabs: ['crm_events', 'gas_api'],
    },
  ],
  MEMBER: [
    { id: 'member_fivestar', label: '全能五星會員系統' },
    { id: 'software_order', label: 'AI 軟體訂購系統' },
    { id: 'member_portal', label: '個人戰情室' },
    { id: 'booking_system', label: 'AI 個人預約系統' },
    { id: 'member_nodes', label: '我的組織與節點' },
    { id: 'registration', label: '推薦夥伴開通' },
  ],
  STORE: [
    { id: 'store_portal', label: '營業店輔導與會員管理' },
  ],
  CENTER: [
    { id: 'center_portal', label: '教育中心與學員' },
    { id: 'center_events', label: '中心活動與花絮' },
  ],
};

function getDefaultTabForRole(role: UserRole): string {
  switch (role) {
    case 'HQ_STAFF':
      return 'overview';
    case 'MEMBER':
      return 'member_fivestar';
    case 'STORE':
      return 'store_portal';
    case 'CENTER':
      return 'center_portal';
  }
}

export default function App() {
  const [initialPortalInfo] = useState(() => parsePortalFromUrl());
  const [lockedPortalRole] = useState<UserRole | null>(initialPortalInfo.lockedRole);
  const [lockedIdentifier, setLockedIdentifier] = useState<string | null>(initialPortalInfo.targetId);
  const [showPublicJoin, setShowPublicJoin] = useState<boolean>(initialPortalInfo.isPublicJoin);
  const [publicJoinSponsorMid] = useState<string | null>(initialPortalInfo.sponsorMid);

  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [splashReady, setSplashReady] = useState<boolean>(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [currentTab, setCurrentTab] = useState<string>('overview');
  const [stats, setStats] = useState<SystemStats>(() => erpEngine.getStats());
  const [isLookupModalOpen, setIsLookupModalOpen] = useState(false);
  const [focusTreeId, setFocusTreeId] = useState<string | undefined>(undefined);
  const [focusMemberOrgNodeId, setFocusMemberOrgNodeId] = useState<string | undefined>(undefined);
  const [settlementTargetNodeId, setSettlementTargetNodeId] = useState<string | undefined>(undefined);
  const [memberNodesSearchMid, setMemberNodesSearchMid] = useState<string>('A-00001');
  const [memberPortalMid, setMemberPortalMid] = useState<string>('A-00001');
  const [storePortalId, setStorePortalId] = useState<string>('S-TAIPEI-01');
  const [centerPortalId, setCenterPortalId] = useState<string>('EDU-TAIPEI-01');
  const [prefillRegClient, setPrefillRegClient] = useState<{
    name: string;
    phone: string;
    line?: string;
    sponsorMid?: string;
  } | null>(null);

  const [isDedicatedMobileUrl] = useState<boolean>(
    initialPortalInfo.deviceMode === 'mobile' || detectLineInAppBrowser()
  );

  const [viewportMode, setViewportMode] = useState<ViewportMode>(() => {
    if (initialPortalInfo.deviceMode === 'mobile') {
      return 'mobile';
    }
    if (initialPortalInfo.deviceMode === 'desktop') {
      return 'desktop';
    }
    if (detectLineInAppBrowser() || detectMobileUserAgent()) {
      return 'mobile';
    }
    try {
      const saved = localStorage.getItem(VIEWPORT_MODE_STORAGE_KEY) as ViewportMode | null;
      if (saved && ['desktop', 'tablet', 'laptop', 'mobile', 'fullscreen'].includes(saved)) {
        return saved;
      }
    } catch {
      // ignore storage error
    }
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'mobile';
    }
    return 'desktop';
  });
  const [isNativeFullscreen, setIsNativeFullscreen] = useState<boolean>(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);
  const [mobilePreset, setMobilePreset] = useState<MobilePhonePreset>(() => {
    try {
      const saved = localStorage.getItem(MOBILE_PRESET_STORAGE_KEY) as MobilePhonePreset | null;
      if (saved === 'compact' || saved === 'standard' || saved === 'large') {
        return saved;
      }
    } catch {
      // ignore storage error
    }
    return isDedicatedMobileUrl ? 'large' : 'standard';
  });
  const [shareDeployModal, setShareDeployModal] = useState<{
    open: boolean;
    tab: ShareDeployModalTab;
  }>({ open: false, tab: 'share' });
  const [fontPrefs, setFontPrefs] = useState<FontPreferences>(() => {
    const initial = loadFontPreferences();
    applyFontPreferencesToDocument(initial);
    return initial;
  });

  useEffect(() => {
    applyFontPreferencesToDocument(fontPrefs);
    const onFontUpdated = (ev: Event) => {
      const detail = (ev as CustomEvent<FontPreferences>).detail;
      if (detail) {
        setFontPrefs(detail);
      }
    };
    window.addEventListener(FONT_UPDATED_EVENT, onFontUpdated);
    return () => window.removeEventListener(FONT_UPDATED_EVENT, onFontUpdated);
  }, []);

  const handleChangeFontPrefs = (next: FontPreferences) => {
    setFontPrefs(next);
    saveFontPreferences(next);
  };

  const refreshStats = () => {
    setStats(erpEngine.getStats());
  };

  useEffect(() => {
    // 清理舊版明文瀏覽器快取並改用伺服器 HttpOnly Cookie 驗證
    try {
      localStorage.removeItem('ais_erp_role_session');
    } catch {
      // ignore
    }

    let cancelled = false;
    apiGetSession(lockedPortalRole)
      .then(async (res) => {
        if (cancelled) return;
        if (res.authenticated && res.session) {
          if (res.bootstrap) {
            erpEngine.hydrateFromServer(res.bootstrap);
          }
          setSession(res.session);
          if (res.session.role === 'MEMBER') {
            setMemberPortalMid(res.session.userId);
            setMemberNodesSearchMid(res.session.userId);
          } else if (res.session.role === 'STORE') {
            setStorePortalId(res.session.userId);
          } else if (res.session.role === 'CENTER') {
            setCenterPortalId(res.session.userId);
          }
          setCurrentTab(getDefaultTabForRole(res.session.role));
          setStats(erpEngine.getStats());
          return;
        }

        if (initialPortalInfo.qrToken) {
          const qrRes = await apiQrLogin(initialPortalInfo.qrToken, lockedPortalRole);
          if (cancelled) return;
          try {
            const cleanedUrl = new URL(window.location.href);
            cleanedUrl.searchParams.delete('qrToken');
            window.history.replaceState({}, '', `${cleanedUrl.pathname}${cleanedUrl.search}${cleanedUrl.hash}`);
          } catch {
            // ignore history error
          }
          if (qrRes.success && qrRes.session) {
            if (qrRes.bootstrap) {
              erpEngine.hydrateFromServer(qrRes.bootstrap);
            }
            setSession(qrRes.session);
            if (qrRes.session.role === 'MEMBER') {
              setMemberPortalMid(qrRes.session.userId);
              setMemberNodesSearchMid(qrRes.session.userId);
            } else if (qrRes.session.role === 'STORE') {
              setStorePortalId(qrRes.session.userId);
            } else if (qrRes.session.role === 'CENTER') {
              setCenterPortalId(qrRes.session.userId);
            }
            setCurrentTab(getDefaultTabForRole(qrRes.session.role));
            setStats(erpEngine.getStats());
            return;
          }
        }

        erpEngine.clearProjection();
        setSession(null);
      })
      .finally(() => {
        if (!cancelled) setAuthChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, [lockedPortalRole]);

  useEffect(() => {
    if (session) {
      refreshStats();
    }
  }, [currentTab, session]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEWPORT_MODE_STORAGE_KEY, viewportMode);
    } catch {
      // ignore storage error
    }
  }, [viewportMode]);

  useEffect(() => {
    try {
      localStorage.setItem(MOBILE_PRESET_STORAGE_KEY, mobilePreset);
    } catch {
      // ignore storage error
    }
  }, [mobilePreset]);

  useEffect(() => {
    const onFsChange = () => {
      const fsActive = Boolean(document.fullscreenElement);
      setIsNativeFullscreen(fsActive);
      if (!fsActive) {
        setViewportMode((prev) => (prev === 'fullscreen' ? 'desktop' : prev));
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleSelectViewportMode = async (nextMode: ViewportMode) => {
    if (nextMode === 'fullscreen') {
      if (viewportMode === 'fullscreen') {
        setViewportMode('desktop');
        if (document.fullscreenElement && document.exitFullscreen) {
          try {
            await document.exitFullscreen();
          } catch {
            // ignore iframe fullscreen restriction
          }
        }
        return;
      }
      setViewportMode('fullscreen');
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        try {
          await document.documentElement.requestFullscreen();
        } catch {
          // graceful full-bleed fallback inside restricted iframes
        }
      }
      return;
    }

    setViewportMode(nextMode);
    if (document.fullscreenElement && document.exitFullscreen) {
      try {
        await document.exitFullscreen();
      } catch {
        // ignore
      }
    }
  };

  const getViewportWrapperClass = (): string => {
    switch (viewportMode) {
      case 'mobile':
        return isDedicatedMobileUrl
          ? 'ais-viewport-frame w-full max-w-[430px] mx-auto sm:my-3 sm:rounded-[28px] sm:border-[3px] sm:border-slate-700 sm:shadow-2xl overflow-hidden min-h-screen sm:min-h-[calc(100vh-3.5rem)] flex flex-col bg-slate-950'
          : 'ais-viewport-frame w-full max-w-[390px] mx-auto sm:my-3 sm:rounded-[28px] sm:border-[3px] sm:border-slate-700 sm:shadow-2xl overflow-hidden min-h-screen sm:min-h-[calc(100vh-3.5rem)] flex flex-col bg-slate-950';
      case 'tablet':
        return 'ais-viewport-frame w-full max-w-[768px] mx-auto my-3 rounded-2xl border-2 border-slate-700 shadow-2xl overflow-hidden min-h-[calc(100vh-3.5rem)] flex flex-col bg-slate-950';
      case 'laptop':
        return 'ais-viewport-frame w-full max-w-[1024px] mx-auto my-2 rounded-xl border border-slate-800 shadow-2xl overflow-hidden min-h-[calc(100vh-3.25rem)] flex flex-col bg-slate-950';
      case 'fullscreen':
        return 'ais-viewport-frame w-full flex-1 flex flex-col bg-slate-950';
      case 'desktop':
      default:
        return 'ais-viewport-frame w-full flex-1 flex flex-col bg-slate-950';
    }
  };

  const handleLoginSuccess = (
    newSession: AuthSession,
    bootstrap?: ScopedBootstrapPayload | null
  ) => {
    if (bootstrap) {
      erpEngine.hydrateFromServer(bootstrap);
    }
    setSession(newSession);
    setPrefillRegClient(null);

    if (newSession.role === 'MEMBER') {
      setMemberPortalMid(newSession.userId);
      setMemberNodesSearchMid(newSession.userId);
    } else if (newSession.role === 'STORE') {
      setStorePortalId(newSession.userId);
    } else if (newSession.role === 'CENTER') {
      setCenterPortalId(newSession.userId);
    }

    setCurrentTab(getDefaultTabForRole(newSession.role));
    refreshStats();
  };

  const handleLogout = async () => {
    await apiLogout();
    erpEngine.clearProjection();
    setSession(null);
    setIsLookupModalOpen(false);
    setMobileDrawerOpen(false);
  };

  const handleResetSystem = () => {
    erpEngine.initializeSystem(true);
    refreshStats();
  };

  const navigateToTreeWithNode = (nodeId?: string) => {
    if (nodeId) setFocusTreeId(nodeId);
    setCurrentTab('tree_explorer');
  };

  const navigateToSettlementWithNode = (nodeId: string) => {
    setSettlementTargetNodeId(nodeId);
    setCurrentTab('settlement');
  };

  const navigateToMemberNodes = (mid: string) => {
    setMemberNodesSearchMid(mid);
    setCurrentTab('member_nodes');
  };

  const navigateToMemberPortal = (mid?: string) => {
    if (mid) setMemberPortalMid(mid);
    setCurrentTab('member_portal');
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setSplashReady(true), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  // Startup Welcome Splash Screen while Render server wakes up & session verifies
  if (!authChecked || !splashReady) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-[radial-gradient(circle_at_top,#1e293b_0%,#020617_70%)] text-slate-100 flex items-center justify-center p-5">
        <div className="w-full max-w-[520px] rounded-3xl overflow-hidden border border-amber-400/35 bg-slate-900 shadow-[0_24px_64px_rgba(0,0,0,0.65)]">
          <div className="relative aspect-video overflow-hidden bg-slate-950">
            <img
              src={welcomeSplashImg}
              alt="歡迎再次光臨"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/20 via-slate-950/45 to-slate-950/90 flex flex-col items-center justify-end px-5 py-6 text-center">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-[0.14em] text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.8)]">
                歡迎再次光臨
              </h1>
              <p className="mt-2 text-base sm:text-lg font-bold tracking-[0.16em] text-amber-200 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
                再等一下！
              </p>
            </div>
          </div>
          <div className="px-5 py-4 flex items-center justify-center gap-2.5 text-xs sm:text-sm text-slate-300 tracking-wide">
            <ShieldCheck className="w-4 h-4 text-amber-300 animate-pulse shrink-0" />
            <span>
              {authChecked ? '安全驗證完成，即將進入系統...' : '系統正在啟動連線中，請稍候片刻...'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Show Public Unauthenticated Join Form or Role Login Gateway if unauthenticated
  if (!session) {
    const isMobilePreview = viewportMode === 'mobile';
    const guestScrollContent = (
      <>
        {/* Mobile Compact Top Bar with Left Three-Line Settings Drawer Trigger */}
        <div
          className={`${
            isMobilePreview ? 'flex' : 'flex md:hidden'
          } sticky top-0 z-40 h-13 px-3 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 items-center justify-between gap-2 shrink-0`}
        >
          <button
            type="button"
            onClick={() => setMobileDrawerOpen((v) => !v)}
            aria-label={mobileDrawerOpen ? '關閉功能設定抽屜' : '開啟功能設定抽屜'}
            aria-expanded={mobileDrawerOpen}
            className="min-w-[44px] min-h-[44px] -ml-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-slate-100 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold text-slate-100 truncate">
            {showPublicJoin ? '新會員自助開通' : '企業智能雲端入口'}
          </span>
          <div className="w-10 shrink-0" aria-hidden="true" />
        </div>

        <LineInAppBanner />
        {showPublicJoin ? (
          <PublicJoinFormView
            initialSponsorMid={publicJoinSponsorMid}
            onGoToLogin={(prefillMid) => {
              if (prefillMid) {
                setLockedIdentifier(prefillMid);
              }
              setShowPublicJoin(false);
            }}
          />
        ) : (
          <RoleLoginPortal
            onLoginSuccess={handleLoginSuccess}
            lockedRole={lockedPortalRole}
            initialIdentifier={lockedIdentifier}
            onOpenPublicJoin={
              lockedPortalRole === 'HQ_STAFF' ? undefined : () => setShowPublicJoin(true)
            }
          />
        )}
      </>
    );

    const guestDrawerOverlay = (
      <MobileSettingsDrawer
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        session={null}
        lockedPortalRole={lockedPortalRole}
        viewportMode={viewportMode}
        isNativeFullscreen={isNativeFullscreen}
        onSelectViewportMode={handleSelectViewportMode}
        fontPrefs={fontPrefs}
        onChangeFontPrefs={handleChangeFontPrefs}
        onOpenShareModal={() => setShareDeployModal({ open: true, tab: 'share' })}
        onOpenDeployModal={() => setShareDeployModal({ open: true, tab: 'deploy' })}
      />
    );

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <ViewportToolbar
          mode={viewportMode}
          isNativeFullscreen={isNativeFullscreen}
          onSelectMode={handleSelectViewportMode}
          fontPrefs={fontPrefs}
          onChangeFontPrefs={handleChangeFontPrefs}
          onOpenShareModal={() => setShareDeployModal({ open: true, tab: 'share' })}
          onOpenDeployModal={() => setShareDeployModal({ open: true, tab: 'deploy' })}
        />
        {isMobilePreview ? (
          <MobileDeviceShell
            preset={mobilePreset}
            onChangePreset={setMobilePreset}
            onExitMobileMode={() => handleSelectViewportMode('desktop')}
            scrollContent={guestScrollContent}
            overlayContent={guestDrawerOverlay}
          />
        ) : (
          <div className="flex-1 bg-slate-950 overflow-x-auto">
            <div data-viewport={viewportMode} className={getViewportWrapperClass()}>
              {guestScrollContent}
              {guestDrawerOverlay}
            </div>
          </div>
        )}
        <PublicShareDeployModal
          isOpen={shareDeployModal.open}
          initialTab={shareDeployModal.tab}
          onClose={() => setShareDeployModal((prev) => ({ ...prev, open: false }))}
          sessionRole={null}
          sessionUserId={null}
          lockedPortalRole={lockedPortalRole}
        />
      </div>
    );
  }

  const navItems = NAV_BY_ROLE[session.role];

  // Helper: HQ Staff compact sub-navigation strip for grouped menus (desktop/tablet only; mobile uses left drawer)
  const renderHqSubNav = () => {
    if (session.role !== 'HQ_STAFF' || viewportMode === 'mobile') return null;

    if (
      ['registration', 'booking_system', 'software_order', 'member_portal', 'member_nodes'].includes(
        currentTab
      )
    ) {
      const subTabs = [
        { id: 'registration', label: '1+1 雙發註冊' },
        { id: 'software_order', label: 'AI 雙軌軟體訂購系統' },
        { id: 'booking_system', label: '第 3 種 AI 個人預約管理' },
        { id: 'member_portal', label: '會員個人戰情室' },
        { id: 'member_nodes', label: '全網結點查詢' },
      ];
      return (
        <div className="mb-6 hidden md:flex flex-wrap items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg w-fit text-xs">
          {subTabs.map((st) => (
            <button
              key={st.id}
              onClick={() => setCurrentTab(st.id)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                currentTab === st.id
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      );
    }

    if (['tree_explorer', 'binary_tree', 'monoline'].includes(currentTab)) {
      const activeTree = currentTab === 'monoline' ? 'monoline' : 'tree_explorer';
      return (
        <div className="mb-6 hidden md:flex flex-wrap items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg w-fit text-xs">
          <button
            onClick={() => setCurrentTab('tree_explorer')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTree === 'tree_explorer'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            BFS 雙軌二元樹
          </button>
          <button
            onClick={() => setCurrentTab('monoline')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTree === 'monoline'
                ? 'bg-teal-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            單軌公排隊列
          </button>
        </div>
      );
    }

    if (['settlement', 'store_portal', 'center_portal'].includes(currentTab)) {
      const subTabs = [
        { id: 'settlement', label: '100% 閉環清算試算' },
        { id: 'store_portal', label: '營業店管理與 6 代輔導' },
        { id: 'center_portal', label: '教育中心管理與 6 代培訓' },
      ];
      return (
        <div className="mb-6 hidden md:flex flex-wrap items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg w-fit text-xs">
          {subTabs.map((st) => (
            <button
              key={st.id}
              onClick={() => setCurrentTab(st.id)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                currentTab === st.id
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      );
    }

    if (['hq_db_admin', 'crm_events', 'gas_api'].includes(currentTab)) {
      const subTabs = [
        { id: 'hq_db_admin', label: '總部資料庫維護 (最高權限)' },
        { id: 'crm_events', label: '通訊錄與活動 (CM/CT/EM/ET)' },
        { id: 'gas_api', label: 'GAS 後端 / MySQL 擴容 & API' },
      ];
      return (
        <div className="mb-6 hidden md:flex flex-wrap items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg w-fit text-xs">
          {subTabs.map((st) => (
            <button
              key={st.id}
              onClick={() => setCurrentTab(st.id)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                currentTab === st.id
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      );
    }

    return null;
  };

  const getActiveHqSubNavItems = (): Array<{ id: string; label: string }> => {
    if (session.role !== 'HQ_STAFF') return [];
    if (
      ['registration', 'booking_system', 'software_order', 'member_portal', 'member_nodes'].includes(
        currentTab
      )
    ) {
      return [
        { id: 'registration', label: '1+1 雙發註冊' },
        { id: 'software_order', label: 'AI 雙軌軟體訂購系統' },
        { id: 'booking_system', label: '第 3 種 AI 個人預約管理' },
        { id: 'member_portal', label: '會員個人戰情室' },
        { id: 'member_nodes', label: '全網結點查詢' },
      ];
    }
    if (['tree_explorer', 'binary_tree', 'monoline'].includes(currentTab)) {
      return [
        { id: 'tree_explorer', label: 'BFS 雙軌二元樹' },
        { id: 'monoline', label: '單軌公排隊列' },
      ];
    }
    if (['settlement', 'store_portal', 'center_portal'].includes(currentTab)) {
      return [
        { id: 'settlement', label: '100% 閉環清算試算' },
        { id: 'store_portal', label: '營業店管理與 6 代輔導' },
        { id: 'center_portal', label: '教育中心管理與 6 代培訓' },
      ];
    }
    if (['hq_db_admin', 'crm_events', 'gas_api'].includes(currentTab)) {
      return [
        { id: 'hq_db_admin', label: '總部資料庫維護 (最高權限)' },
        { id: 'crm_events', label: '通訊錄與活動 (CM/CT/EM/ET)' },
        { id: 'gas_api', label: 'GAS 後端 / MySQL 擴容 & API' },
      ];
    }
    return [];
  };

  const activeHqSubNavItems = getActiveHqSubNavItems();
  const isFullBleed = viewportMode === 'fullscreen';
  const isMobileMode = viewportMode === 'mobile';

  const authScrollContent = (
    <>
      <LineInAppBanner />
      {/* Top Bar strictly obeying 3-Zone Contract & Mobile Left Drawer */}
      <Header
        session={session}
        navItems={navItems}
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onLogout={handleLogout}
        fullWidth={isFullBleed}
        lockedPortalRole={lockedPortalRole}
        onOpenMobileDrawer={() => setMobileDrawerOpen((v) => !v)}
        mobileDrawerOpen={mobileDrawerOpen}
        isMobileMode={isMobileMode}
      />

      <main
        className={`ais-app-main flex-1 ${
          isFullBleed ? 'max-w-none' : 'max-w-7xl'
        } w-full mx-auto px-4 sm:px-6 lg:px-8 py-8`}
      >
        {/* ================= ROLE 1: HQ STAFF PORTAL (FULL ADMIN ACCESS · LAZY LOADED) ================= */}
        {session.role === 'HQ_STAFF' && (
          <Suspense
            fallback={
              <div className="py-12 text-center text-xs text-slate-400">
                正在安全解密載入總部管控模組...
              </div>
            }
          >
            {renderHqSubNav()}

            {currentTab === 'overview' && (
              <OverviewView
                stats={stats}
                onNavigate={setCurrentTab}
                onOpenRegister={() => setCurrentTab('registration')}
              />
            )}

            {currentTab === 'member_portal' && (
              <MemberPortalView
                initialMid={memberPortalMid}
                scopedMode={false}
                onNavigateToTree={navigateToTreeWithNode}
                onNavigateToMonoline={() => setCurrentTab('monoline')}
                onNavigateToRegisterWithSponsor={(sponsorMid) => {
                  setPrefillRegClient({ name: '', phone: '', sponsorMid });
                  setCurrentTab('registration');
                }}
                onNavigateToStorePortal={(storeId) => {
                  setStorePortalId(storeId);
                  setCurrentTab('store_portal');
                }}
                onNavigateToCenterPortal={(centerId) => {
                  setCenterPortalId(centerId);
                  setCurrentTab('center_portal');
                }}
                onNavigateToSettlement={navigateToSettlementWithNode}
                onNavigateToCrmEvents={() => setCurrentTab('crm_events')}
                onNavigateToBooking={() => setCurrentTab('booking_system')}
              />
            )}

            {currentTab === 'booking_system' && (
              <BookingSystemView
                ownerMid={memberPortalMid}
                isHqAdminView={true}
                onNavigateToRegisterWithClient={(client) => {
                  setPrefillRegClient(client);
                  setCurrentTab('registration');
                }}
                onRenewalCompleted={refreshStats}
              />
            )}

            {currentTab === 'software_order' && (
              <SoftwareOrderSystemView
                memberMid={memberPortalMid}
                isHqAdminView={true}
                theme="dark"
                onOpenModule={(key) => {
                  if (key === 'BOOKING') setCurrentTab('booking_system');
                  else setCurrentTab('member_portal');
                }}
                onInspectBinaryNode={navigateToTreeWithNode}
                onOrderCompleted={refreshStats}
              />
            )}

            {currentTab === 'registration' && (
              <RegistrationSimulator
                prefillClient={prefillRegClient}
                scopedMemberMode={false}
                onNodeCreated={refreshStats}
                onNavigateToTree={navigateToTreeWithNode}
                onNavigateToMonoline={() => setCurrentTab('monoline')}
                onNavigateToMemberNodes={navigateToMemberNodes}
                onNavigateToCrmEvents={() => setCurrentTab('crm_events')}
                onNavigateToMemberPortal={navigateToMemberPortal}
              />
            )}

            {currentTab === 'crm_events' && (
              <CrmEventsView
                onNavigateToMemberNodes={navigateToMemberNodes}
                onNavigateToRegister={() => setCurrentTab('registration')}
              />
            )}

            {(currentTab === 'tree_explorer' || currentTab === 'binary_tree') && (
              <DualTreeVisualizer
                initialFocusId={focusTreeId}
                onSelectForSettlement={navigateToSettlementWithNode}
                onNavigateToMemberNodes={navigateToMemberNodes}
                onNavigateToMemberPortal={navigateToMemberPortal}
              />
            )}

            {currentTab === 'monoline' && (
              <MonolineQueueView
                onSelectNode={navigateToSettlementWithNode}
                onNavigateToTree={() => setCurrentTab('tree_explorer')}
              />
            )}

            {currentTab === 'member_nodes' && (
              <MemberNodesView
                initialQuery={memberNodesSearchMid}
                scopedMode={false}
                onNavigateToTree={navigateToTreeWithNode}
                onSelectForSettlement={navigateToSettlementWithNode}
                onNavigateToMemberPortal={navigateToMemberPortal}
              />
            )}

            {currentTab === 'store_portal' && (
              <StorePortalView
                initialStoreId={storePortalId}
                scopedMode={false}
                onNavigateToMemberNodes={navigateToMemberNodes}
                onNavigateToMemberPortal={navigateToMemberPortal}
              />
            )}

            {currentTab === 'center_portal' && (
              <CenterPortalView
                initialCenterId={centerPortalId}
                scopedMode={false}
                onNavigateToMemberNodes={navigateToMemberNodes}
                onNavigateToMemberPortal={navigateToMemberPortal}
              />
            )}

            {currentTab === 'settlement' && (
              <SettlementCalculator
                initialNodeId={settlementTargetNodeId}
                onSettlementExecuted={refreshStats}
              />
            )}

            {currentTab === 'gas_api' && <GasCodeAndApiView />}

            {currentTab === 'hq_db_admin' && (
              <HqDatabaseAdminView
                onDatabaseChanged={refreshStats}
                onNavigateToGasCode={() => setCurrentTab('gas_api')}
              />
            )}
          </Suspense>
        )}

        {/* ================= ROLE 2: GENERAL MEMBER PORTAL (STRICTLY SCOPED TO SELF) ================= */}
        {session.role === 'MEMBER' && (
          <>
            {currentTab === 'member_fivestar' && (
              <MemberFiveStarWorkspace
                memberMid={session.userId}
                initialOrgNodeId={focusMemberOrgNodeId}
                onNodesChanged={refreshStats}
                onNavigateToPortal={() => setCurrentTab('member_portal')}
                onNavigateToBooking={() => setCurrentTab('booking_system')}
                onNavigateToRegisterWithClient={(client) => {
                  setPrefillRegClient(client);
                  setCurrentTab('registration');
                }}
              />
            )}

            {currentTab === 'software_order' && (
              <SoftwareOrderSystemView
                memberMid={session.userId}
                isHqAdminView={false}
                theme="dark"
                onOpenModule={(key) =>
                  setCurrentTab(key === 'BOOKING' ? 'booking_system' : 'member_fivestar')
                }
                onInspectBinaryNode={(nodeId) => {
                  setFocusMemberOrgNodeId(nodeId);
                  setCurrentTab('member_fivestar');
                }}
                onOrderCompleted={refreshStats}
              />
            )}

            {currentTab === 'member_portal' && (
              <MemberPortalView
                initialMid={session.userId}
                scopedMode={true}
                onNavigateToRegisterWithSponsor={(sponsorMid) => {
                  setPrefillRegClient({ name: '', phone: '', sponsorMid });
                  setCurrentTab('registration');
                }}
                onNavigateToBooking={() => setCurrentTab('booking_system')}
              />
            )}

            {currentTab === 'booking_system' && (
              <BookingSystemView
                ownerMid={session.userId}
                isHqAdminView={false}
                onNavigateToRegisterWithClient={(client) => {
                  setPrefillRegClient(client);
                  setCurrentTab('registration');
                }}
                onRenewalCompleted={refreshStats}
              />
            )}

            {currentTab === 'member_nodes' && (
              <MemberNodesView
                initialQuery={session.userId}
                scopedMode={true}
                onNavigateToTree={() => {}}
                onSelectForSettlement={() => {}}
              />
            )}

            {currentTab === 'registration' && (
              <RegistrationSimulator
                prefillClient={prefillRegClient}
                lockedSponsorMid={session.userId}
                scopedMemberMode={true}
                onNodeCreated={refreshStats}
                onNavigateToTree={() => {}}
                onNavigateToMonoline={() => {}}
              />
            )}
          </>
        )}

        {/* ================= ROLE 3: BUSINESS STORE PORTAL (STRICTLY SCOPED TO OWN STORE) ================= */}
        {session.role === 'STORE' && (
          <StorePortalView
            initialStoreId={session.userId}
            scopedMode={true}
          />
        )}

        {/* ================= ROLE 4: EDUCATION CENTER PORTAL (STRICTLY SCOPED TO OWN CENTER + EVENTS) ================= */}
        {session.role === 'CENTER' && (
          <>
            {currentTab === 'center_portal' && (
              <CenterPortalView
                initialCenterId={session.userId}
                scopedMode={true}
              />
            )}

            {currentTab === 'center_events' && (
              <CrmEventsView
                eventsOnlyMode={true}
                scopedTitle={`${session.displayName} · 中心活動行事曆與花絮`}
              />
            )}
          </>
        )}
      </main>

      {/* Scoped Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/50 py-6 pb-16 sm:pb-6 text-xs text-slate-400">
        <div
          className={`${
            isFullBleed ? 'max-w-none' : 'max-w-7xl'
          } mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4`}
        >
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-1 text-center sm:text-left">
            <span className="font-semibold text-slate-300">
              {session.role === 'HQ_STAFF'
                ? '產銷合一物流直銷單軌轉雙軌 SaaS ERP 系統'
                : '企業智能雲端營運平台'}
            </span>
            <span aria-hidden="true">·</span>
            <span>角色權限嚴格隔離視角 ({session.displayName})</span>
          </div>
          <div className="font-mono text-slate-500 text-center sm:text-right">
            {session.role === 'HQ_STAFF'
              ? '定海神針: C-25000001 · 公司自營63席: A-00001~A-00063 · 對外開放: A-00064起'
              : '3 大 AI 智能雲端工具 · 伺服器加密授權保護'}
          </div>
        </div>
      </footer>
    </>
  );

  const authOverlayContent = (
    <>
      <MobileSettingsDrawer
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        session={session}
        lockedPortalRole={lockedPortalRole}
        navItems={navItems}
        subNavItems={activeHqSubNavItems}
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onLogout={handleLogout}
        viewportMode={viewportMode}
        isNativeFullscreen={isNativeFullscreen}
        onSelectViewportMode={handleSelectViewportMode}
        fontPrefs={fontPrefs}
        onChangeFontPrefs={handleChangeFontPrefs}
        onOpenShareModal={() => setShareDeployModal({ open: true, tab: 'share' })}
        onOpenDeployModal={() => setShareDeployModal({ open: true, tab: 'deploy' })}
      />

      {/* HQ-Only Floating Bottom Quick Toolbar & Global Lookup Modal */}
      {session.role === 'HQ_STAFF' && (
        <>
          <aside aria-label="總部工具列" className="fixed bottom-4 right-4 z-30 flex items-center gap-2">
            <button
              onClick={() => setIsLookupModalOpen(true)}
              className="px-3.5 py-2 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-semibold rounded-lg shadow-lg flex items-center gap-2 backdrop-blur-md cursor-pointer transition-colors"
            >
              <Search className="w-3.5 h-3.5 text-indigo-400" />
              <span>全網速查 (A-碼 / C-碼)</span>
            </button>

            <button
              onClick={handleResetSystem}
              title="重設回初始開局狀態"
              className="p-2 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-400 hover:text-rose-400 rounded-lg shadow-lg backdrop-blur-md cursor-pointer transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </aside>

          <Suspense fallback={null}>
            <MemberLookupModal
              isOpen={isLookupModalOpen}
              onClose={() => setIsLookupModalOpen(false)}
              onSelectForSettlement={navigateToSettlementWithNode}
              onNavigateToTree={navigateToTreeWithNode}
              onNavigateToMemberNodes={navigateToMemberNodes}
              onNavigateToMemberPortal={navigateToMemberPortal}
            />
          </Suspense>
        </>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <ViewportToolbar
        mode={viewportMode}
        isNativeFullscreen={isNativeFullscreen}
        onSelectMode={handleSelectViewportMode}
        fontPrefs={fontPrefs}
        onChangeFontPrefs={handleChangeFontPrefs}
        onOpenShareModal={() => setShareDeployModal({ open: true, tab: 'share' })}
        onOpenDeployModal={() => setShareDeployModal({ open: true, tab: 'deploy' })}
      />

      {isMobileMode ? (
        <MobileDeviceShell
          preset={mobilePreset}
          onChangePreset={setMobilePreset}
          onExitMobileMode={() => handleSelectViewportMode('desktop')}
          scrollContent={authScrollContent}
          overlayContent={authOverlayContent}
        />
      ) : (
        <div className="flex-1 bg-slate-950 overflow-x-auto flex flex-col">
          <div data-viewport={viewportMode} className={getViewportWrapperClass()}>
            {authScrollContent}
            {authOverlayContent}
          </div>
        </div>
      )}

      <PublicShareDeployModal
        isOpen={shareDeployModal.open}
        initialTab={shareDeployModal.tab}
        onClose={() => setShareDeployModal((prev) => ({ ...prev, open: false }))}
        sessionRole={session.role}
        sessionUserId={session.userId}
        lockedPortalRole={lockedPortalRole}
        onNavigateHqGas={
          session.role === 'HQ_STAFF' ? () => setCurrentTab('gas_api') : undefined
        }
        onHydrated={refreshStats}
      />
    </div>
  );
}
