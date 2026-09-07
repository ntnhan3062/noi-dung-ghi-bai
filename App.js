
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { html } from './utils/html.js';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link, useNavigate } from 'react-router-dom';
import { Explorer } from './pages/Explorer.js';
import { AuthGuard } from './pages/AuthGuard.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { BookOpen, Lock, ShieldAlert } from 'lucide-react';
import { apiService } from './services/apiService.js';
import { BreadcrumbProvider, useBreadcrumbs } from './context/BreadcrumbContext.js';
import { ClassProvider, useClasses } from './context/ClassContext.js';
import { Breadcrumbs } from './components/Breadcrumbs.js';
import { ClassManagementPage } from './pages/ClassManagementPage.js';
import { ChevronDown, Settings as SettingsIcon, Trash2, Edit2, GripVertical } from 'lucide-react';
import { StatusPage } from './components/StatusPage.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { LayoutErrorProvider, useLayoutError } from './context/LayoutErrorContext.js';

const getBasename = () => {
  const path = window.location.pathname;
  const hostname = window.location.hostname;
  const isGithub = hostname.includes('github.io');

  if (path.includes('/special-application')) {
      const index = path.indexOf('/special-application');
      return path.substring(0, index + '/special-application'.length);
  }
  
  if (isGithub && path.includes('/noi-dung-ghi-bai')) {
      return '/noi-dung-ghi-bai';
  }

  return '';
};

const AnimatedRoutes = ({ isAppMode, uiConfig }) => {
    const location = useLocation();
    const prevDepth = useRef(0);
    const [direction, setDirection] = useState('right');

    useEffect(() => {
        const currentDepth = location.pathname.split('/').filter(Boolean).length;
        if (currentDepth > prevDepth.current) setDirection('right');
        else if (currentDepth < prevDepth.current) setDirection('left');
        prevDepth.current = currentDepth;
    }, [location.pathname]);

    const animationClass = isAppMode 
        ? (direction === 'right' ? 'animate-[slideInRight_0.3s_ease-out]' : 'animate-[slideInLeft_0.3s_ease-out]') 
        : '';

    return html`
        <div className=${`w-full ${animationClass}`}>
            <${Routes}>
                <${Route} key="route-home" path="/" element=${html`<${Navigate} to="/view" replace />`} />
                <${Route} key="route-view" path="/view" element=${html`<${Explorer} mode="view" isAppMode=${isAppMode} uiConfig=${uiConfig} />`} />
                <${Route} key="route-view-node" path="/view/:nodeId" element=${html`<${Explorer} mode="view" isAppMode=${isAppMode} uiConfig=${uiConfig} />`} />
                ${!isAppMode && html`
                    <${React.Fragment}>
                        <${Route} key="route-edit" path="/edit" element=${html`<${AuthGuard}><${Explorer} mode="edit" uiConfig=${uiConfig} /></${AuthGuard}>`} />
                        <${Route} key="route-settings" path="/edit/settings" element=${html`<${AuthGuard}><${SettingsPage} /></${AuthGuard}>`} />
                        <${Route} key="route-classes" path="/edit/classes" element=${html`<${AuthGuard}><${ClassManagementPage} /></${AuthGuard}>`} />
                        <${Route} key="route-edit-node" path="/edit/:nodeId" element=${html`<${AuthGuard}><${Explorer} mode="edit" uiConfig=${uiConfig} /></${AuthGuard}>`} />
                    </${React.Fragment}>
                `}
                <${Route} key="route-catch-all" path="*" element=${html`<${StatusPage} type="not-found" />`} />
            </${Routes}>
        </div>
    `;
}

const Layout = ({ children, isAppMode, uiConfig, currentBg, isOnline }) => {
  const { layoutError } = useLayoutError();
  const location = useLocation();
  const navigate = useNavigate();
  const { breadcrumbs, isVisible } = useBreadcrumbs();
  const { classes, selectedClassId, setSelectedClassId } = useClasses();
  const isEditMode = location.pathname.startsWith('/edit');
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [secretCount, setSecretCount] = useState(0);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsClassDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const homePaths = ['/view', '/view/', '/edit', '/edit/', '/'];
  const isHome = homePaths.includes(location.pathname);
  const showClassSelector = isHome && !layoutError;

  useEffect(() => {
    let timer;
    if (secretCount > 0) timer = setTimeout(() => setSecretCount(0), 1000);
    return () => clearTimeout(timer);
  }, [secretCount]);

  const handleNavigate = useCallback((id) => {
    const basePath = isEditMode ? '/edit' : '/view';
    if (!id) navigate(basePath);
    else navigate(`${basePath}/${id}`);
  }, [isEditMode, navigate]);

  const handleSecretEntry = useCallback(() => {
    if (isAppMode) {
      handleNavigate(null);
      return;
    }
    if (isEditMode) return;
    const newCount = secretCount + 1;
    setSecretCount(newCount);
    if (newCount >= 5) {
      setSecretCount(0);
      navigate('/edit');
    }
  }, [isAppMode, isEditMode, secretCount, handleNavigate, navigate]);

  useEffect(() => {
    if (isAppMode) {
      window.returnPage = () => {
        if (breadcrumbs.length > 0) {
          // Parent node is the second-to-last item in breadcrumbs
          // If only 1 item, parent is null (home)
          const parent = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2] : null;
          handleNavigate(parent?.id || null);
        }
      };
    }
    return () => {
      delete window.returnPage;
    };
  }, [isAppMode, breadcrumbs, handleNavigate]);

  const isLiquid = uiConfig.style === 'liquid';

  return html`
    <!-- BACKGROUND -->
    <div key="layout-background" className="fixed inset-0 -z-10 bg-slate-50 overflow-hidden pointer-events-none transition-all duration-1000">
        ${(uiConfig.backgroundActive && currentBg) ? html`
            <div key="bg-image" className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-1000 ease-in-out" style=${{ backgroundImage: `url('${currentBg}')` }}>
                <div className="absolute inset-0 bg-white/30 backdrop-blur-[2px]"></div>
            </div>
        ` : isLiquid ? html`
            <div key="liquid-blobs" className="absolute inset-0 overflow-hidden">
                <div key="blob-1" className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] bg-indigo-300/30 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-blob"></div>
                <div key="blob-2" className="absolute top-[-10%] right-[-10%] w-[800px] h-[800px] bg-purple-300/30 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-blob animation-delay-2000"></div>
                <div key="blob-3" className="absolute -bottom-32 left-[20%] w-[800px] h-[800px] bg-pink-300/30 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-blob animation-delay-4000"></div>
                <div key="blob-4" className="absolute top-[40%] right-[30%] w-[600px] h-[600px] bg-cyan-200/40 rounded-full mix-blend-multiply filter blur-[80px] opacity-60 animate-blob animation-delay-2000"></div>
                <div key="blob-5" className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-yellow-200/40 rounded-full mix-blend-multiply filter blur-[80px] opacity-60 animate-blob animation-delay-4000"></div>
            </div>
        ` : html`
             <div key="bg-default" className="absolute inset-0 bg-slate-50"></div>
        `}
    </div>

    <div key="layout-main" className="min-h-screen flex flex-col overflow-x-hidden">
      ${isAppMode && !isOnline && html`
        <div key="offline-banner" className="bg-red-500/10 border-b border-red-500/20 py-2.5 px-4 text-center flex items-center justify-center gap-2 text-xs font-sans font-bold text-red-600 animate-pulse">
          <${ShieldAlert} size=${14} /> Bạn đang sử dụng ứng dụng ngoại tuyến. Một số nội dung mới nhất có thể chưa hiển thị.
        </div>
      `}
      <header className=${`sticky top-0 z-30 transition-all duration-300 ${isAppMode ? 'h-16' : 'h-20'} ${isLiquid ? 'bg-white/60 backdrop-blur-xl border-b border-white/20' : 'bg-white border-b border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer select-none active:scale-95 transition-transform group" onClick=${handleSecretEntry}>
            <div key="logo-container" className=${`relative p-2.5 rounded-2xl border transition-all duration-500 overflow-hidden ${isLiquid ? 'bg-white/20 backdrop-blur-md border-white/50 shadow-glass group-hover:shadow-neon' : 'bg-white border-slate-200 shadow-sm'} ${secretCount > 0 ? 'ring-2 ring-indigo-400' : ''}`}>
              ${isLiquid && html`<div key="liquid-bg" className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>`}
              <${BookOpen} key="logo-icon" className=${`relative z-10 text-indigo-600 drop-shadow-sm ${isAppMode ? "w-5 h-5" : "w-7 h-7"}`} strokeWidth=${2.5} />
            </div>
            <div key="logo-text" className="flex flex-col">
                <span key="main-label" className=${`font-sans font-bold tracking-tight drop-shadow-sm ${isAppMode ? 'text-xl' : 'text-2xl'} ${isLiquid ? 'bg-clip-text text-transparent bg-gradient-to-r from-indigo-900 to-violet-900' : 'text-slate-800'}`}>${layoutError ? 'Nội dung bài học' : 'Nội dung ghi bài'}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <!-- Class Selection Dropdown -->
            ${showClassSelector && html`
              <div className="relative" ref=${dropdownRef}>
                <button 
                  onClick=${() => setIsClassDropdownOpen(!isClassDropdownOpen)}
                  className=${`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border ${isLiquid ? 'bg-white/30 border-white/40 hover:bg-white/50 text-indigo-900' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'}`}
                >
                  ${selectedClass ? selectedClass.title : 'Chọn lớp'}
                  <${ChevronDown} size=${16} className=${`transition-transform ${isClassDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                ${isClassDropdownOpen && html`
                  <div className=${`absolute right-0 mt-2 w-56 rounded-2xl shadow-2xl border z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${isLiquid ? 'bg-white/80 backdrop-blur-xl border-white/60' : 'bg-white border-slate-200'}`}>
                    <div className="max-h-64 overflow-y-auto py-2">
                      ${classes.length === 0 ? html`
                        <div className="px-4 py-3 text-xs text-slate-400 text-center italic">Chưa có lớp nào</div>
                      ` : classes.map(cls => html`
                        <button
                          key=${cls.id}
                          onClick=${() => { setSelectedClassId(cls.id); setIsClassDropdownOpen(false); }}
                          className=${`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-between ${selectedClassId === cls.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                          ${cls.title}
                          ${selectedClassId === cls.id && html`<div className="w-2 h-2 rounded-full bg-indigo-500"></div>`}
                        </button>
                      `)}
                    </div>
                    
                    ${isEditMode && html`
                      <div className="border-t border-slate-100 p-2">
                        <${Link} 
                          to="/edit/classes" 
                          onClick=${() => setIsClassDropdownOpen(false)}
                          className="flex items-center gap-2 w-full px-3 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <${SettingsIcon} size=${14} />
                          Quản lý lớp
                        </${Link}>
                      </div>
                    `}
                  </div>
                `}
              </div>
            `}

            <nav className="flex items-center gap-3">
              ${isEditMode && !isAppMode && !layoutError && html`
                <${Link} key="view-mode-link" to="/view" className=${`relative overflow-hidden flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-full transition-all group ${isLiquid ? 'text-indigo-900 bg-white/30 hover:bg-white/60 border border-white/60 shadow-glass hover:shadow-lg backdrop-blur-md' : 'text-slate-600 bg-white border border-gray-200 hover:bg-gray-50 hover:text-indigo-600'}`}>
                  ${isLiquid && html`<div key="liquid-overlay" className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>`}
                  <${BookOpen} key="view-icon" size=${16} /> Chế độ xem
                </${Link}>
              `}
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <!-- Persistent Breadcrumbs -->
        ${isVisible && breadcrumbs.length > 0 && html`
          <div className="sticky top-[4.5rem] md:top-24 z-20 mb-8 px-2">
             <${Breadcrumbs} items=${breadcrumbs} onNavigate=${handleNavigate} isLiquid=${isLiquid} />
          </div>
        `}
        
        ${children}
      </main>
      <footer className=${`border-t py-8 mt-auto ${isLiquid ? 'bg-white/30 border-white/20 backdrop-blur-sm' : 'bg-white border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p key="footer-text" className="text-slate-900 text-sm font-sans font-medium">
            <span key="copyright">© ${new Date().getFullYear()} Nội dung ghi bài.</span>
            ${!isAppMode && html`
              <${React.Fragment} key="footer-extra">
                <span key="sep" className="text-slate-400 mx-2">|</span>
                <span key="system" className=${isLiquid ? 'bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500 font-bold' : 'text-indigo-600 font-bold'}>Cloud System</span>
              </${React.Fragment}>
            `}
          </p>
        </div>
      </footer>
    </div>
  `;
};

const AccessDenied = () => {
    return html`<${StatusPage} type="access-denied" subMessage="Yêu cầu không hợp lệ. Bạn cần có đủ mã khóa xác thực để truy cập ứng dụng này." />`;
};

const App = () => {
  const [isAuthorized, setIsAuthorized] = useState(true);
  const isAppMode = window.location.pathname.includes('/special-application');
  const [isOnline, setIsOnline] = useState(true);
  const [uiConfig, setUiConfig] = useState({ style: 'liquid', zoom: { view: true, edit: true, app: false }, backgroundActive: false, backgrounds: [] });
  const [currentBg, setCurrentBg] = useState(null);

  const initConfig = useCallback(async () => {
      let fullConfig = null;
      try {
          fullConfig = await apiService.getFullConfig();
          if (fullConfig && isAppMode) {
              localStorage.setItem('cached_full_config', JSON.stringify(fullConfig));
          }
      } catch (e) {
          console.error("Failed to fetch full config, trying to use offline cache:", e);
      }

      if (!fullConfig && isAppMode) {
          try {
              const cached = localStorage.getItem('cached_full_config');
              if (cached) {
                  fullConfig = JSON.parse(cached);
              }
          } catch (e) {
              console.error("Failed to parse cached full config:", e);
          }
      }

      if (!fullConfig) {
          fullConfig = { classes: [], background: { images: [], active: false }, ui: { style: 'liquid', zoom: { view: true, edit: true, app: false } } };
      }

      const bgImages = (fullConfig.background && Array.isArray(fullConfig.background.images)) ? fullConfig.background.images : [];
      const bgActive = !!(fullConfig.background && fullConfig.background.active);
      const uiStyle = (fullConfig.ui && fullConfig.ui.style) || 'liquid';
      const uiZoom = (fullConfig.ui && fullConfig.ui.zoom) || { view: true, edit: true, app: false };

      setUiConfig({
          style: uiStyle,
          zoom: uiZoom,
          backgroundActive: bgActive,
          backgrounds: bgImages
      });
      try {
          localStorage.setItem('style_mode', uiStyle);
      } catch (e) {
          console.error(e);
      }
      
      if (bgActive && bgImages.length > 0) {
        setCurrentBg(bgImages[Math.floor(Math.random() * bgImages.length)]);
      }
  }, []);

  useEffect(() => {
    const triggerOnlineUpdate = (isConnected) => {
      setIsOnline(isConnected);
      if (isConnected) {
        window.dispatchEvent(new CustomEvent('app-network-online'));
      }
    };

    // Đăng ký các hàm toàn cục để ứng dụng điện thoại tự chạy và cập nhật trạng thái kết nối mạng
    window.setOffline = (isOffline) => {
      triggerOnlineUpdate(!isOffline);
    };
    window.setOfflineMode = (isOffline) => {
      triggerOnlineUpdate(!isOffline);
    };
    window.setOfflineStatus = (isOffline) => {
      triggerOnlineUpdate(!isOffline);
    };
    window.setOfflineState = (isOffline) => {
      triggerOnlineUpdate(!isOffline);
    };
    window.updateNetworkStatus = (isConnected) => {
      triggerOnlineUpdate(isConnected);
    };
    window.setNetworkStateUnified = (value, modeType = 'online') => {
      const isOnlineState = modeType === 'offline' ? !value : !!value;
      triggerOnlineUpdate(isOnlineState);
    };

    return () => {
      delete window.setOffline;
      delete window.setOfflineMode;
      delete window.setOfflineStatus;
      delete window.setOfflineState;
      delete window.updateNetworkStatus;
      delete window.setNetworkStateUnified;
    };
  }, []);

  useEffect(() => {
    if (isAppMode) {
        const params = new URLSearchParams(window.location.search);
        const REQUIRED_KEYS = { 'key': 'NoiDungGhiBaiSecret2024', 'key1': 'lty7zpnw5osslfj1o89znurovmi0y8d9cv5zuukgxigqbowjyaf3hnek0toeee0tdh6h6gtixzt3v6fmafpr9qsowkns9pyswavb', 'key2': 'anklp677xs4nukuzzbiluus4q5yssi9wr662tqcth6sfacdlm0wcafae0dopwm5c7d3t36yqh1us1ok7rpt0y75dry0bsmkkpqga', 'key3': 'g81jkmi8bu2rrlvhffxa3kl0ameqg15ywdsvrm1b7f4j9swj6pr3rtsr2dqmwv1sygflf36ytudl3md56f8xo170f2z0zd7e70oy0idfe0fufq4eexptckzufcnkkpqt6bb6mtf498ipnevocimmi9', 'key4': 'xzyne6bybfqbam1bqabtrkgyo7vxsz68zr0w6w5g5od9rmjg4i3jnmobscejymmwte7wk7qcmpew8ivzyxh6witbd70q7an5aizec1fr911hogee27ve539zy3zlloqwnhzm0lkr2bfxj51pqofipo', 'key5': '2l36em0t88qlugivnz6x8b8rzwseoawequ578dzy2yuly7kiy58vyjwy3pvv1ap7x806mgx8vcilp0aycrn4taa01n3k12c10cymgkm3ay9ij1g25n2kim30cg0hui6697vw68qw6106b907z4efklmkfs0gb9th8mke9w0zngih3lcc2gc1204llbvvsjo5dixkupo5' };
        let isValid = true;
        for (const [paramName, expectedValue] of Object.entries(REQUIRED_KEYS)) { if (params.get(paramName) !== expectedValue) { isValid = false; break; } }
        if (!isValid) setIsAuthorized(false);
    }
  }, [isAppMode]);

  useEffect(() => {
      initConfig();
  }, [initConfig]);

  useEffect(() => {
    const handleOnlineEvent = () => {
      if (isAppMode) {
        initConfig();
      }
    };
    window.addEventListener('app-network-online', handleOnlineEvent);
    return () => window.removeEventListener('app-network-online', handleOnlineEvent);
  }, [isAppMode, initConfig]);

  useEffect(() => {
    if (!uiConfig?.backgroundActive || !Array.isArray(uiConfig?.backgrounds) || uiConfig.backgrounds.length <= 1) return;
    const interval = setInterval(() => {
        const otherBgs = (uiConfig.backgrounds || []).filter(bg => bg !== currentBg);
        if (otherBgs.length > 0) setCurrentBg(otherBgs[Math.floor(Math.random() * otherBgs.length)]);
    }, 60000);
    return () => clearInterval(interval);
  }, [uiConfig, currentBg]);

  const hasOfflineCache = (() => {
    try {
      if (!isAppMode) return false;
      const cached = localStorage.getItem('cached_nodes');
      if (!cached) return false;
      const parsed = JSON.parse(cached);
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  })();

  if (!isAuthorized) return html`
    <${LayoutErrorProvider}>
      <${StatusPage} type="access-denied" subMessage="Yêu cầu không hợp lệ. Bạn cần có đủ mã khóa xác thực để truy cập ứng dụng này." />
    </${LayoutErrorProvider}>
  `;

  return html`
    <${LayoutErrorProvider}>
      <${BrowserRouter} basename=${getBasename()}>
        <${ErrorBoundary}>
          <${ClassProvider}>
            <${BreadcrumbProvider}>
              <${Layout} isAppMode=${isAppMode} uiConfig=${uiConfig} currentBg=${currentBg} isOnline=${isOnline}>
                 <${AnimatedRoutes} isAppMode=${isAppMode} uiConfig=${uiConfig} />
              </${Layout}>
            </${BreadcrumbProvider}>
          </${ClassProvider}>
        </${ErrorBoundary}>
      </${BrowserRouter}>
    </${LayoutErrorProvider}>
  `;
};

export default App;
