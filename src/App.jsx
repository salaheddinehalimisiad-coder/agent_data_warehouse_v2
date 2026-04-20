// src/App.jsx — Application v3.0 SP1 — Ultra-Premium Redesigned Layout
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Terminal, LogOut, Database, ChevronLeft, ChevronRight,
  Settings, Activity, Sparkles, ShieldCheck, Star, GitMerge,
  BrainCircuit, Zap, Sun, Moon, Book, Lock
} from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import ToastNotifications from './components/ToastNotifications';

// ── Strict/Light components (Eager Load) ────────────────────────
import LandingPage       from './components/LandingPage';
import LoadingScreen     from './components/LoadingScreen';
import ConnectionModal   from './components/ConnectionModal';
import AuthModal         from './components/AuthModal';
const DataCatalog       = React.lazy(() => import('./components/DataCatalog'));
const NeuralBackground  = React.lazy(() => import('./components/NeuralBackground'));

// ── Heavy components (Lazy Load) ───────────────────────────────
const PipelineCanvas    = React.lazy(() => import('./components/PipelineCanvas'));
const ChatInterface     = React.lazy(() => import('./components/ChatInterface'));
const HumanReviewPanel  = React.lazy(() => import('./components/HumanReviewPanel'));
const DataExplorer      = React.lazy(() => import('./components/DataExplorer'));
const ExecutionLog      = React.lazy(() => import('./components/ExecutionLog'));
const ExportPanel       = React.lazy(() => import('./components/ExportPanel'));
const SettingsPage      = React.lazy(() => import('./components/SettingsPage'));
const StarSchemaViewer  = React.lazy(() => import('./components/StarSchemaViewer'));
const DataQualityPanel  = React.lazy(() => import('./components/DataQualityPanel'));
const GovernancePanel   = React.lazy(() => import('./components/GovernancePanel'));
const DocumentationPage = React.lazy(() => import('./components/DocumentationPage'));
const ArchitectureInspector = React.lazy(() => import('./components/ArchitectureInspector'));
const LineageGraph          = React.lazy(() => import('./components/LineageGraph'));
const RunMetrics            = React.lazy(() => import('./components/RunMetrics'));

import { usePipelineStore } from './store/pipelineStore';
import { apiClient } from './api/client';
import confetti from 'canvas-confetti';

// ─── Status Badge ────────────────────────────────────────────────────────────
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
  const isAnimated = status === 'running' || status === 'starting';
  return (
    <span className={`badge ${cfg.cls} ${isAnimated ? 'animate-pulse-soft' : ''}`}>
      {isAnimated && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {cfg.l}
    </span>
  );
}

// ─── Active Agent Pill ────────────────────────────────────────────────────────
function ActiveAgentPill({ agent }) {
  if (!agent) return null;
  const labels = {
    explorer: 'Explorer', data_quality: 'Data Quality', drift_detector: 'Drift Detector',
    modeler: 'Modeler', governance: 'Governance', critic: 'Critic', human_review: 'Review',
    chat_modifier: 'Chat Modifier', etl_generator: 'ETL Generator',
    etl_executor: 'ETL Executor', healer: 'Healer', 
    insight_generator: 'Insight', forecaster: 'Forecaster', 
    cataloger: 'Cataloger', airflow_generator: 'Airflow Generator',
    dbt_generator: 'dbt Generator', mock_generator: 'Synthesizer', 
    lineage_tracker: 'Lineage',
  };
  return (
    <motion.div
      key={agent}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-1.5 text-[11px] font-medium text-blue-300 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full"
    >
      <motion.span
        className="w-1.5 h-1.5 rounded-full bg-blue-400"
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 1.2, repeat: Infinity }}
      />
      {labels[agent] || agent}
    </motion.div>
  );
}

const LEFT_PANEL_TABS = [
  { id: 'pipeline', icon: Activity,     label: 'Pipeline'     },
  { id: 'architect',icon: BrainCircuit, label: 'Inspector'    },
  { id: 'explorer', icon: Database,     label: 'Source'       },
  { id: 'schema',   icon: Star,         label: 'OLAP Schema'  },
  { id: 'governance',icon: Lock,        label: 'Security'     },
  { id: 'catalog',  label: 'Catalog',   icon: Book            },
  { id: 'quality',  icon: ShieldCheck,  label: 'Validation'   },
  { id: 'lineage',  icon: GitMerge,     label: 'Lineage'      },
  { id: 'metrics',  label: 'Metrics',   icon: Activity        },
];

export default function App() {
  const {
    pipelineStatus, executionLog, setAuth, authToken,
    userPrefix, logout, resetPipeline,
    healHistory, schemaDriftDetected, currentAgent,
    sessionId, dqScore, dqAlerts, logicalModel, pipelineProgress
  } = usePipelineStore();

  const [appView,         setAppView]        = useState('landing');
  const [showConnection,  setShowConnection] = useState(false);
  const [showAuth,        setShowAuth]       = useState(false);
  const [showLog,         setShowLog]        = useState(false);
  const [showExport,      setShowExport]     = useState(false);
  const [showSettings,    setShowSettings]   = useState(false);
  const [activeMainView,  setActiveMainView] = useState('pipeline');
  const [leftCollapsed,   setLeftCollapsed]  = useState(true);
  const [rightCollapsed,  setRightCollapsed] = useState(false);
  const [backendOk,       setBackendOk]      = useState(null);
  const [isDarkMode,      setIsDarkMode]     = useState(true);
  const exportRef = useRef(null);

  useEffect(() => {
    const token  = localStorage.getItem('auth_token');
    const uid    = localStorage.getItem('user_id');
    const prefix = localStorage.getItem('user_prefix') || 'dw';
    if (token && uid) setAuth(token, parseInt(uid), prefix);
    apiClient.checkHealth().then(ok => setBackendOk(ok));

    // Restore dark mode preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') setIsDarkMode(false);
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    document.documentElement.classList.toggle('light-mode', !isDarkMode);
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const isRunning        = ['starting', 'running'].includes(pipelineStatus);
  const isAwaitingReview = pipelineStatus === 'awaiting_review' || pipelineStatus === 'awaiting_dq_review';
  const isComplete       = pipelineStatus === 'complete';

  // Ctrl+K shortcut → New Pipeline
  useEffect(() => {
    const handleKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (!isRunning) { resetPipeline(); setShowConnection(true); }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isRunning]);

  useEffect(() => {
    // Only auto-open log during an ACTIVE pipeline error (has events)
    if (pipelineStatus === 'error' && executionLog?.length > 0) setShowLog(true);
    // Auto-reset stale error state when no events (leftover from previous session)
    if (pipelineStatus === 'error' && (!executionLog || executionLog.length === 0)) {
      resetPipeline();
    }
  }, [pipelineStatus]);

  useEffect(() => {
    if (dqScore !== null && dqAlerts?.some(a => a.severity === 'error')) {
      setActiveMainView('quality');
    }
  }, [dqScore]);

  useEffect(() => {
    if (pipelineStatus === 'awaiting_review') {
      setActiveMainView('architect');
    }
    if (pipelineStatus === 'awaiting_dq_review') {
      setActiveMainView('quality');
    }
    if (pipelineStatus === 'complete') {
      setTimeout(() => setActiveMainView('metrics'), 1000);
    }
  }, [pipelineStatus]);

  useEffect(() => {
    const handler = (e) => {
      if (showExport && exportRef.current && !exportRef.current.contains(e.target)) {
        setShowExport(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExport]);


  useEffect(() => {
    if (isComplete) {
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
      const randomInRange = (min, max) => Math.random() * (max - min) + min;

      const interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);
        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);
    }
  }, [isComplete]);

  return (
    <div className="relative flex flex-col h-screen overflow-hidden font-sans selection:bg-indigo-500/30 transition-colors duration-500" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {/* ── Neural Environment ────────────────────────────────────────────── */}
      <NeuralBackground />
      
      {/* ── Toast Notifications ────────────────────────────────────────── */}
      <ToastNotifications />
      
      {/* ── Cinematic Grain Overlay ────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none z-[300] opacity-[0.03] mix-blend-overlay bg-[url('/noise.svg')]" />
      
      {/* ── Neural Identity Scanning Line ───────────────────────────────────── */}
      <motion.div 
        animate={{ y: ['0%', '100%'] }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        className="fixed inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent z-[310] blur-sm pointer-events-none" 
      />
      
      {/* ── Global Overlays (Always available) ──────────────────────────────── */}
      <AnimatePresence>
        {showConnection && (
          <ConnectionModal 
            isOpen={showConnection} 
            onClose={() => setShowConnection(false)} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAuth && (
          <AuthModal 
            isOpen={showAuth} 
            onClose={() => setShowAuth(false)} 
          />
        )}
      </AnimatePresence>

      {/* ── View Routing ────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {appView === 'loading' && (
          <motion.div key="loading" initial={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[200]">
            <LoadingScreen onComplete={() => setAppView('landing')} />
          </motion.div>
        )}

        {appView === 'landing' && (
          <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[190]">
            <LandingPage
              onEnterDashboard={() => setAppView('dashboard')}
              onSelectSource={() => { 
                setAppView('dashboard'); 
                setShowConnection(true); 
              }}
              onAuthOpen={() => setShowAuth(true)}
              onDocsOpen={() => setAppView('docs')}
              isDarkMode={isDarkMode}
              setIsDarkMode={setIsDarkMode}
              user={authToken ? { token: authToken, prefix: userPrefix } : null}
            />
          </motion.div>
        )}

        {appView === 'docs' && (
          <motion.div key="docs" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="absolute inset-0 z-[220]">
             <div className="absolute top-6 left-6 z-[230]">
                <button 
                  onClick={() => setAppView('landing')}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-glow hover:bg-indigo-500 transition-all"
                >
                  <ChevronLeft size={16}/> Retour Accueil
                </button>
             </div>
             <ErrorBoundary>
               <Suspense fallback={<div className="flex h-full items-center justify-center text-indigo-400"><BrainCircuit className="animate-pulse" size={24}/></div>}>
                 <DocumentationPage />
               </Suspense>
             </ErrorBoundary>
          </motion.div>
        )}

        {showSettings && (
          <motion.div key="settings" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="absolute inset-0 z-[210]">
             <ErrorBoundary>
               <Suspense fallback={null}>
                 <SettingsPage onBack={() => setShowSettings(false)} />
               </Suspense>
             </ErrorBoundary>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Dashboard Layout ───────────────────────────────────────────── */}
      {appView === 'dashboard' && !showSettings && (
        <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>
          {/* Ambient glow — very subtle */}
          <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/3 blur-[140px] rounded-full" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-600/3 blur-[140px] rounded-full" />
          </div>

          {/* ── Header v5.0 (Premium Dark) ───────────────────────────────────── */}
          <header
            className="relative flex items-center px-6 h-16 border-b shrink-0 z-40 backdrop-blur-xl"
            style={{ borderColor: 'var(--border-soft)', background: 'rgba(6,8,17,0.7)' }}
          >
            {/* Brand — logo premium avec halo violet + dot live */}
            <div className="flex items-center gap-3 mr-6">
              <div
                className="relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-grad-violet shadow-glow-violet"
              >
                <Sparkles size={16} className="text-white drop-shadow" strokeWidth={2.5} />
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse-soft ring-2 ring-ink-950" />
              </div>
              <div className="leading-tight">
                <h1 className="text-[14px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  Antigravity <span className="gradient-text">BI</span>
                </h1>
                <p className="text-[10px] font-mono text-slate-500 leading-none mt-0.5">v5.0 · Premium Dark</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <StatusBadge status={pipelineStatus} />
              <AnimatePresence mode="wait">
                {currentAgent && <ActiveAgentPill agent={currentAgent} />}
              </AnimatePresence>
              {dqScore !== null && (
                <span className={`badge text-[11px] ${
                  dqScore >= 80 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  : dqScore >= 60 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                  : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                }`}>
                  DQ {Math.round(dqScore)}%
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="ml-auto flex items-center gap-2">
              {/* Log toggle — labelled for discoverability */}
              <button
                id="toggle-log-btn"
                onClick={() => setShowLog(v => !v)}
                className={`btn btn-ghost btn-icon text-[12px] flex items-center gap-1.5 px-3 ${
                  showLog ? 'text-white bg-white/8' : ''
                }`}
                title="Technical Logs"
              >
                <Terminal size={14} />
                <span className="text-[11px] font-medium hidden lg:inline" style={{ color: showLog ? 'var(--text-primary)' : 'var(--text-secondary)' }}>Logs</span>
              </button>

              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="relative flex items-center justify-center w-8 h-8 rounded-full border transition-all duration-300 overflow-hidden hover:scale-105 shadow-sm mx-1"
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}
                title={isDarkMode ? 'Mode Clair' : 'Mode Sombre'}
              >
                <Sun 
                  className={`absolute transition-all duration-500 ease-in-out text-amber-500 ${isDarkMode ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50'}`} 
                  size={15} 
                />
                <Moon 
                  className={`absolute transition-all duration-500 ease-in-out text-indigo-500 ${isDarkMode ? 'opacity-0 -rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'}`} 
                  size={15} 
                />
              </button>

              <button
                onClick={() => setShowSettings(true)}
                className="btn btn-ghost btn-icon"
                title="Settings"
              >
                <Settings size={15} />
              </button>

              {authToken && (
                <button onClick={logout} className="btn btn-ghost btn-icon" title="Sign out">
                  <LogOut size={15} />
                </button>
              )}

              <div className="w-px h-5 mx-1" style={{ background: 'var(--border-subtle)' }} />

              <div className="flex bg-white/5 rounded-xl p-1 border border-white/10 mx-2 hidden lg:flex">
                 <button 
                  onClick={() => setActiveMainView('pipeline')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeMainView === 'pipeline' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                 >
                   Pipeline
                 </button>
                 <button 
                  onClick={() => setActiveMainView('architect')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeMainView === 'architect' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                 >
                   Architecture
                 </button>
              </div>

              <button
                id="new-pipeline-btn"
                onClick={() => { resetPipeline(); setShowConnection(true); }}
                disabled={isRunning}
                className="btn btn-primary gap-2"
              >
                <Play size={13} fill="currentColor" />
                New Pipeline
                <kbd className="hidden lg:inline-flex text-[9px] font-mono bg-white/15 px-1.5 py-0.5 rounded border border-white/20 ml-1">⌘K</kbd>
              </button>
            </div>
          </header>

          {/* ── Pipeline Progress Bar ─────────────────────────────────────────────── */}
          {(pipelineStatus === 'running' || pipelineStatus === 'starting') && (
            <div className="h-0.5 w-full shrink-0 relative overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700"
                style={{ width: `${Math.max(5, pipelineProgress)}%` }}
              />
            </div>
          )}

          {/* ── Main Layout Body ─────────────────────────────────────────────────── */}
          <div className="relative flex flex-1 overflow-hidden z-10 min-h-0">
            {/* ── Slim Left Navigation Sidebar ───────────────────────────────────── */}
            <aside
              className="flex flex-col border-r shrink-0 transition-all duration-300"
              style={{
                width: leftCollapsed ? '64px' : '200px',
                borderColor: 'var(--border-subtle)',
                background: 'var(--bg-base)',
              }}
            >
              <div className="flex flex-col py-6 gap-2 overflow-y-auto custom-scrollbar flex-1">
                {LEFT_PANEL_TABS.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeMainView === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveMainView(tab.id)}
                      title={tab.label}
                      className={`flex items-center gap-3 mx-3 px-3 py-3 rounded-xl transition-all font-medium whitespace-nowrap overflow-hidden shrink-0 ${
                        isActive
                          ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                          : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
                      }`}
                    >
                      <Icon size={18} className="shrink-0" />
                      {!leftCollapsed && <span className="text-[12px] uppercase tracking-widest font-black">{tab.label}</span>}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setLeftCollapsed(v => !v)}
                className="flex items-center justify-center p-4 border-t text-slate-600 hover:text-slate-300 transition-colors shrink-0"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                {leftCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
            </aside>

            {/* ── Central Main Canvas ────────────────────────────────────────────── */}
            <main className="flex-1 relative overflow-hidden flex flex-col" style={{ background: 'var(--bg-base)' }}>
               <ErrorBoundary>
                 <Suspense fallback={
                   <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 opacity-40">
                     <Activity size={24} className="animate-pulse text-indigo-400" />
                     <span className="label-sm uppercase tracking-widest text-xs">Loading view...</span>
                   </div>
                 }>
                    {activeMainView === 'pipeline'  && <PipelineCanvas />}
                    {activeMainView === 'explorer'  && <DataExplorer />}
                    {activeMainView === 'schema'    && <StarSchemaViewer />}
                    {activeMainView === 'catalog'   && <DataCatalog />}
                    {activeMainView === 'quality'   && <DataQualityPanel />}
                    {activeMainView === 'architect' && <ArchitectureInspector />}
                    {activeMainView === 'lineage'   && <LineageGraph />}
                    {activeMainView === 'metrics'   && <RunMetrics />}
                    {activeMainView === 'governance' && <GovernancePanel />}
                 </Suspense>
               </ErrorBoundary>
            </main>

            {/* ── AI Copilot Sidebar ────────────────────────────────────────────── */}
            <aside
              className="flex flex-col border-l shrink-0 transition-all duration-300"
              style={{
                width: rightCollapsed ? '48px' : '360px',
                borderColor: 'var(--border-subtle)',
                background: 'var(--bg-base)',
              }}
            >
              {/* Collapse toggle at top */}
              <div
                className="flex items-center justify-between px-3 h-10 border-b shrink-0"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                {!rightCollapsed && (
                  <span className="label-xs flex items-center gap-1.5">
                    <BrainCircuit size={11} className="text-indigo-400" />
                    {isAwaitingReview ? 'Human Review' : 'AI Copilot'}
                  </span>
                )}
                <button
                  onClick={() => setRightCollapsed(v => !v)}
                  className="btn btn-ghost btn-icon p-1.5 ml-auto"
                >
                  {rightCollapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                </button>
              </div>

              <div className="flex-1 overflow-hidden relative min-h-0">
                <AnimatePresence mode="wait">
                  {!rightCollapsed && (
                    <motion.div
                      key={isAwaitingReview ? 'review' : 'chat'}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="h-full"
                    >
                      <ErrorBoundary>
                        <Suspense fallback={
                          <div className="h-full flex items-center justify-center opacity-40">
                            <Activity size={20} className="animate-pulse" />
                          </div>
                        }>
                          {isAwaitingReview ? <HumanReviewPanel /> : <ChatInterface />}
                        </Suspense>
                      </ErrorBoundary>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </aside>
          </div>


          {/* ── Collapsible Technical Log Panel ─────────────────────────────────── */}
          <AnimatePresence>
            {showLog && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 240 }}
                exit={{ height: 0 }}
                className="relative z-50 overflow-hidden border-t shrink-0"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                 <ErrorBoundary>
                   <Suspense fallback={null}>
                     <ExecutionLog onClose={() => setShowLog(false)} />
                   </Suspense>
                 </ErrorBoundary>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isComplete && (
              <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100]">
                <div className="relative group p-0.5 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-500 shadow-2xl shadow-emerald-500/20 overflow-hidden cursor-pointer">
                  <button onClick={() => setShowExport(true)} className="bg-black px-8 py-3.5 rounded-2xl flex items-center gap-3 group-hover:bg-black/80 transition-colors">
                    <Zap size={18} className="text-emerald-400 fill-emerald-400" />
                    <span className="text-[12px] font-black tracking-widest text-white uppercase italic">EXPORTER LE RÉSULTAT</span>
                    <ChevronRight size={18} className="text-white group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
                {showExport && (
                  <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 min-w-[320px]" ref={exportRef}>
                    <ErrorBoundary>
                      <Suspense fallback={null}>
                        <ExportPanel sessionId={sessionId} authToken={authToken} />
                      </Suspense>
                    </ErrorBoundary>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
