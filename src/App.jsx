// src/App.jsx
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Terminal, LogOut, Database, ChevronLeft, ChevronRight,
  Settings, Activity, Sparkles, ShieldCheck, Star, GitMerge,
  BrainCircuit, Zap, Sun, Moon, Book, Lock, Home, User, AlertCircle,
  Download
} from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import ToastNotifications, { addToast } from './components/ToastNotifications';
import AgentBILogo from './components/AgentBILogo';

// ── Components Eager Loading
import LandingPage       from './components/LandingPage';
import LoadingScreen     from './components/LoadingScreen';
import ConnectionModal   from './components/ConnectionModal';
import AuthModal         from './components/AuthModal';
const DataCatalog       = React.lazy(() => import('./components/DataCatalog'));
const NeuralBackground  = React.lazy(() => import('./components/NeuralBackground'));

// ── Components Lazy Loading
const PipelineCanvas    = React.lazy(() => import('./components/PipelineCanvas'));
const ChatInterface     = React.lazy(() => import('./components/ChatInterface'));
const HumanReviewPanel  = React.lazy(() => import('./components/HumanReviewPanel'));
const DataExplorer      = React.lazy(() => import('./components/DataExplorer'));
const ExecutionLog      = React.lazy(() => import('./components/ExecutionLog'));
const ExportPanel       = React.lazy(() => import('./components/ExportPanel'));
const SettingsPage      = React.lazy(() => import('./components/SettingsPage'));
const ProfilePage       = React.lazy(() => import('./components/ProfilePage'));
const StarSchemaViewer  = React.lazy(() => import('./components/StarSchemaViewer'));
const DataQualityPanel  = React.lazy(() => import('./components/DataQualityPanel'));
const GovernancePanel   = React.lazy(() => import('./components/GovernancePanel'));
const DocumentationPage = React.lazy(() => import('./components/DocumentationPage'));
const ArchitectureInspector = React.lazy(() => import('./components/ArchitectureInspector'));
const LineageGraph          = React.lazy(() => import('./components/LineageGraph'));
const RunMetrics            = React.lazy(() => import('./components/RunMetrics'));
const UseCaseFlow           = React.lazy(() => import('./components/UseCaseFlow'));

import { usePipelineStore } from './store/pipelineStore';
import { apiClient } from './api/client';
import confetti from 'canvas-confetti';

// ─── Status Badge Component
function StatusBadge({ status }) {
  const cfgs = {
    idle:              { l: 'Standby',    cls: 'badge-idle'    },
    starting:          { l: 'Starting',   cls: 'badge-running' },
    running:           { l: 'Running',    cls: 'badge-running' },
    awaiting_review:   { l: 'Review',     cls: 'badge-waiting' },
    awaiting_dq_review:{ l: 'DQ Alert',  cls: 'badge-error'   },
    complete:          { l: 'Complete',   cls: 'badge-done'    },
    error:             { l: 'Error',      cls: 'badge-error'   },
  };
  const cfg = cfgs[status] || cfgs.idle;
  return (
    <span className={`badge ${cfg.cls} ${(status === 'running' || status === 'starting') ? 'animate-pulse-soft' : ''}`}>
      {(status === 'running' || status === 'starting') && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {cfg.l}
    </span>
  );
}

// ─── Main App Component
export default function App() {
  const {
    pipelineStatus, executionLog, setAuth, authToken, userId,
    userPrefix, logout, resetPipeline, currentAgent,
    dqScore, dqAlerts, pipelineProgress, sessionId
  } = usePipelineStore();

  const [appView, setAppView] = useState('landing');
  const [showConnection, setShowConnection] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [activeMainView, setActiveMainView] = useState('pipeline');
  const [leftCollapsed, setLeftCollapsed] = useState(false); // Sidebar ouverte par défaut
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [profile, setProfile] = useState(null);
  const [welcomeUser, setWelcomeUser] = useState(null);
  const [hasAvatar, setHasAvatar] = useState(false);
  const [avatarBust, setAvatarBust] = useState(Date.now());
  const welcomedRef = useRef(false);
  const [goodbyeUser, setGoodbyeUser] = useState(null);

  // 1. Persistance et Theme
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const uid = localStorage.getItem('user_id');
    const prefix = localStorage.getItem('user_prefix') || 'dw';
    if (token && uid) setAuth(token, parseInt(uid), prefix);
    
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') setIsDarkMode(false);

    if (!token) {
      setAppView('auth');
      setShowAuth(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const handleLogout = () => {
    const displayName = (profile?.full_name || (profile?.email ? profile.email.split('@')[0] : '')) || userPrefix || 'utilisateur';
    setGoodbyeUser(displayName);
    setTimeout(() => {
      setGoodbyeUser(null);
      logout();
      setAppView('auth');
      setShowAuth(true);
    }, 2200);
  };

  // 2. Gestion de la Sidebar Tabs (avec alertes visuelles)
  const LEFT_PANEL_TABS = [
    { id: 'pipeline', icon: Activity, label: 'Pipeline', alert: ['running', 'starting'].includes(pipelineStatus) },
    { id: 'architect',icon: BrainCircuit, label: 'Inspector', alert: pipelineStatus === 'awaiting_review' },
    { id: 'explorer', icon: Database, label: 'Source', alert: false },
    { id: 'schema',   icon: Star, label: 'OLAP Schema', alert: pipelineStatus === 'complete' },
    { id: 'quality',  icon: ShieldCheck, label: 'Quality', alert: pipelineStatus === 'awaiting_dq_review' || (dqScore !== null && dqScore < 50) },
    { id: 'catalog',  icon: Book, label: 'Catalog', alert: false },
    { id: 'lineage',  icon: GitMerge, label: 'Lineage', alert: false },
    { id: 'metrics',  icon: Activity, label: 'Metrics', alert: false },
    { id: 'export',   icon: Download, label: 'Export', alert: pipelineStatus === 'complete' },
  ];

  // 3. Empêcher l'arrêt du pipeline en quittant l'onglet
  const renderView = (viewId, Component) => {
    return (
      <div 
        key={viewId}
        className={`absolute inset-0 transition-opacity duration-300 ${activeMainView === viewId ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
        style={{ display: activeMainView === viewId ? 'block' : 'none' }} // Trick CSS pour garder le composant monté
      >
        <Suspense fallback={<div className="flex h-full items-center justify-center opacity-20"><Activity className="animate-spin" /></div>}>
          {Component}
        </Suspense>
      </div>
    );
  };

  return (
    <div className="relative flex flex-col h-screen overflow-hidden font-sans transition-colors duration-500" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <NeuralBackground />
      <ToastNotifications />
      
      {/* Navigation Overlays */}
      <AnimatePresence>
        {showConnection && <ConnectionModal isOpen={showConnection} onClose={() => setShowConnection(false)} />}
        {showAuth && <AuthModal isOpen={showAuth} onClose={() => authToken && setShowAuth(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {goodbyeUser && (
          <motion.div key="goodbye" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[500] flex items-center justify-center backdrop-blur-xl" style={{ background: 'rgba(6,8,17,0.85)' }}>
            <motion.div initial={{ scale: 0.85, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }} className="flex flex-col items-center gap-4 px-10 py-8 rounded-3xl border shadow-2xl" style={{ background: 'linear-gradient(140deg, rgba(79,70,229,0.25), rgba(147,51,234,0.18))', borderColor: 'rgba(255,255,255,0.08)' }}>
              <div className="relative drop-shadow-[0_8px_30px_rgba(139,92,246,0.35)]">
                <AgentBILogo size={80} variant="hero" animated />
              </div>
              <motion.h2 initial={{ letterSpacing: '0.02em' }} animate={{ letterSpacing: '0.12em' }} transition={{ duration: 1.4, ease: 'easeOut' }} className="text-3xl md:text-4xl font-black tracking-widest text-white uppercase">
                Good bye, <span className="gradient-text">{goodbyeUser}</span>
              </motion.h2>
              <p className="text-[12px] font-mono text-slate-400">À bientôt sur Agent BI ✨</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main View Routing */}
      <AnimatePresence mode="wait">
        {appView === 'landing' && (
          <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[190]">
            <LandingPage
              onEnterDashboard={() => authToken ? setAppView('dashboard') : setShowAuth(true)}
              onSelectSource={() => { setAppView('dashboard'); setShowConnection(true); }}
              onAuthOpen={() => setShowAuth(true)}
              onUseCaseOpen={() => setAppView('usecases')}
              isDarkMode={isDarkMode}
              setIsDarkMode={setIsDarkMode}
              user={authToken ? { prefix: userPrefix } : null}
            />
          </motion.div>
        )}

        {appView === 'usecases' && (
          <motion.div key="usecases" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="absolute inset-0 z-[220] overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
             <button onClick={() => setAppView('landing')} className="fixed top-6 left-6 z-[230] flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-glow">
               <ChevronLeft size={16}/> Retour Accueil
             </button>
             <Suspense fallback={null}><div className="pt-24 pb-12 min-h-screen"><UseCaseFlow /></div></Suspense>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dashboard Layout */}
      {appView === 'dashboard' && (
        <div className="flex flex-col h-full z-10">
          {/* Header */}
          <header className="flex items-center px-6 h-16 border-b shrink-0 backdrop-blur-xl border-white/5 bg-black/40">
            <button onClick={() => setAppView('landing')} className="flex items-center gap-3 mr-6">
              <AgentBILogo size={32} variant="mark" animated />
              <div className="text-left hidden md:block">
                <h1 className="text-sm font-bold tracking-tight">Agent <span className="gradient-text">BI</span></h1>
              </div>
            </button>
            <div className="flex items-center gap-3">
              <StatusBadge status={pipelineStatus} />
              {dqScore !== null && <span className="badge text-[10px] bg-white/5 border-white/10">DQ {Math.round(dqScore)}%</span>}
            </div>
            <div className="ml-auto flex items-center gap-3">
              <button onClick={() => setShowLog(!showLog)} className={`btn btn-ghost px-3 h-9 ${showLog ? 'bg-white/10' : ''}`}><Terminal size={14}/></button>
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center">{isDarkMode ? <Sun size={14}/> : <Moon size={14}/>}</button>
              <button onClick={handleLogout} className="btn btn-ghost btn-icon" title="Se déconnecter"><LogOut size={15} /></button>
              <button onClick={() => { resetPipeline(); setShowConnection(true); }} className="btn btn-primary h-9 gap-2"><Play size={12} fill="currentColor"/> New Pipeline</button>
            </div>
          </header>

          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar Navigation */}
            <aside className="flex flex-col border-r border-white/5 transition-all duration-300" style={{ width: leftCollapsed ? '64px' : '200px' }}>
              <div className="flex-1 py-4 flex flex-col gap-1 overflow-y-auto">
                <button onClick={() => setAppView('landing')} className="flex items-center gap-3 mx-3 p-3 rounded-xl text-indigo-400 hover:bg-white/5">
                  <Home size={18}/> {!leftCollapsed && <span className="text-[11px] font-black uppercase tracking-widest">Accueil</span>}
                </button>
                <div className="mx-5 my-2 border-t border-white/5" />
                {LEFT_PANEL_TABS.map(tab => (
                  <button 
                    key={tab.id} 
                    onClick={() => setActiveMainView(tab.id)}
                    className={`flex items-center gap-3 mx-3 p-3 rounded-xl transition-all relative ${activeMainView === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5'}`}
                  >
                    <tab.icon size={18}/>
                    {!leftCollapsed && <span className="text-[11px] font-black uppercase tracking-widest">{tab.label}</span>}
                    {tab.alert && <span className="absolute right-2 top-2 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
                  </button>
                ))}
              </div>
              <button onClick={() => setLeftCollapsed(!leftCollapsed)} className="p-4 border-t border-white/5 text-slate-500 hover:text-white">
                {leftCollapsed ? <ChevronRight size={18}/> : <ChevronLeft size={18}/>}
              </button>
            </aside>

            {/* Central Canvas - Tous les composants restent montés mais HIDDEN */}
            <main className="flex-1 relative" style={{ background: 'var(--bg-base)' }}>
              <ErrorBoundary>
                {renderView('pipeline', <PipelineCanvas />)}
                {renderView('explorer', <DataExplorer />)}
                {renderView('schema',   <StarSchemaViewer />)}
                {renderView('catalog',  <DataCatalog />)}
                {renderView('quality',  <DataQualityPanel />)}
                {renderView('architect',<ArchitectureInspector />)}
                {renderView('lineage',  <LineageGraph />)}
                {renderView('metrics',  <RunMetrics />)}
                {renderView('governance',<GovernancePanel />)}
                {renderView('export',   <ExportPanel onClose={undefined} />)}
              </ErrorBoundary>
            </main>

            {/* AI Sidebar */}
            <aside className="border-l border-white/5 transition-all duration-300" style={{ width: rightCollapsed ? '48px' : '350px' }}>
              <div className="flex flex-col h-full bg-black/20">
                <div className="flex items-center justify-between p-3 border-b border-white/5">
                  {!rightCollapsed && <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Assistant IA</span>}
                  <button onClick={() => setRightCollapsed(!rightCollapsed)} className="p-1 hover:bg-white/5 rounded"><ChevronRight size={14} className={rightCollapsed ? 'rotate-180' : ''}/></button>
                </div>
                {!rightCollapsed && (
                  <div className="flex-1 overflow-hidden">
                    <Suspense fallback={null}>{pipelineStatus?.includes('review') ? <HumanReviewPanel /> : <ChatInterface />}</Suspense>
                  </div>
                )}
              </div>
            </aside>
          </div>

          {/* Logs Panel */}
          <AnimatePresence>
            {showLog && (
              <motion.div initial={{ height: 0 }} animate={{ height: 250 }} exit={{ height: 0 }} className="border-t border-white/10 bg-black/80">
                <Suspense fallback={null}><ExecutionLog onClose={() => setShowLog(false)} /></Suspense>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Custom Global Styles */}
      <style>{`
        .gradient-text { background: linear-gradient(to right, #818cf8, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .shadow-glow { box-shadow: 0 0 20px rgba(79, 70, 229, 0.4); }
        .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 99px; font-weight: 800; font-size: 10px; text-transform: uppercase; border: 1px solid transparent; }
        .badge-running { background: rgba(59, 130, 246, 0.1); color: #60a5fa; border-color: rgba(59, 130, 246, 0.2); }
        .badge-waiting { background: rgba(245, 158, 11, 0.1); color: #fbbf24; border-color: rgba(245, 158, 11, 0.2); }
        .badge-error { background: rgba(239, 68, 68, 0.1); color: #f87171; border-color: rgba(239, 68, 68, 0.2); }
        .badge-done { background: rgba(16, 185, 129, 0.1); color: #34d399; border-color: rgba(16, 185, 129, 0.2); }
        .badge-idle { background: rgba(148, 163, 184, 0.1); color: #94a3b8; border-color: rgba(148, 163, 184, 0.2); }
      `}</style>
    </div>
  );
}