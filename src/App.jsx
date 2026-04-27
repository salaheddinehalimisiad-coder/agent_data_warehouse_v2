// src/App.jsx
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Terminal, LogOut, Database, ChevronLeft, ChevronRight,
  Settings, Activity, Sparkles, ShieldCheck, Star, GitMerge,
  BrainCircuit, Zap, Sun, Moon, Book, Lock, Home, User, AlertCircle,
  Download, BarChart3, Layers, Table2, Search, Bell, Workflow,
  TrendingUp, FlaskConical, Map, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import ToastNotifications, { addToast } from './components/ToastNotifications';
import AgentBILogo from './components/AgentBILogo';

// ── Eager
import LandingPage       from './components/LandingPage';
import LoadingScreen     from './components/LoadingScreen';
import ConnectionModal   from './components/ConnectionModal';
import AuthModal         from './components/AuthModal';
const DataCatalog       = React.lazy(() => import('./components/DataCatalog'));
const NeuralBackground  = React.lazy(() => import('./components/NeuralBackground'));

// ── Lazy
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
const QueryRunner           = React.lazy(() => import('./components/QueryRunner'));
const OlapExplorer          = React.lazy(() => import('./components/OlapExplorer'));
const UseCaseFlow           = React.lazy(() => import('./components/UseCaseFlow'));

import { usePipelineStore } from './store/pipelineStore';
import { apiClient } from './api/client';
import confetti from 'canvas-confetti';

// ─── Fallback spinner
const Spinner = () => (
  <div className="flex h-full items-center justify-center">
    <Activity size={18} className="animate-spin" style={{ color: 'var(--blue-400)', opacity: 0.5 }} />
  </div>
);

// ─── Status pill
function StatusPill({ status }) {
  const map = {
    idle:               { label: 'Standby',   color: 'var(--text-muted)',   bg: 'rgba(148,163,184,0.07)', border: 'rgba(148,163,184,0.12)' },
    starting:           { label: 'Starting',  color: 'var(--blue-300)',     bg: 'rgba(61,106,232,0.1)',   border: 'rgba(61,106,232,0.2)',  pulse: true },
    running:            { label: 'Running',   color: 'var(--blue-300)',     bg: 'rgba(61,106,232,0.1)',   border: 'rgba(61,106,232,0.2)',  pulse: true },
    awaiting_review:    { label: 'Review',    color: 'var(--amber-400)',    bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.18)' },
    awaiting_dq_review: { label: 'DQ Alert',  color: 'var(--red-400)',      bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.18)'  },
    complete:           { label: 'Complete',  color: 'var(--green-400)',    bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.18)'  },
    error:              { label: 'Error',     color: 'var(--red-400)',      bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.18)'  },
  };
  const cfg = map[status] || map.idle;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 99,
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
    }}>
      {cfg.pulse && (
        <span style={{
          width: 5, height: 5, borderRadius: '50%', background: cfg.color,
          display: 'inline-block', animation: 'pulse-soft 1.8s ease-in-out infinite'
        }} />
      )}
      {cfg.label}
    </span>
  );
}

// ─── Docs standalone
const IS_DOCS_TAB = new URLSearchParams(window.location.search).get('view') === 'docs';
function DocsStandalone() {
  return (
    <div className="min-h-screen overflow-y-auto" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <Suspense fallback={<Spinner />}><DocumentationPage /></Suspense>
    </div>
  );
}

// ─── Nav section divider
function NavSection({ label }) {
  return (
    <div style={{
      padding: '12px 16px 4px',
      fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
      color: 'var(--text-dim)',
    }}>{label}</div>
  );
}

// ─── Nav item
function NavItem({ icon: Icon, label, active, alert, collapsed, onClick }) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        margin: '1px 8px', padding: collapsed ? '10px 13px' : '9px 12px',
        borderRadius: 8, width: 'calc(100% - 16px)',
        fontSize: 12, fontWeight: active ? 600 : 400,
        color: active ? 'var(--blue-300)' : 'var(--text-secondary)',
        background: active ? 'rgba(61,106,232,0.12)' : 'transparent',
        borderLeft: active ? '2px solid var(--blue-400)' : '2px solid transparent',
        transition: 'all 0.15s ease',
        position: 'relative',
        cursor: 'pointer', border: 'none',
        outline: 'none',
        textAlign: 'left',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <Icon size={15} style={{ flexShrink: 0, opacity: active ? 1 : 0.7 }} />
      {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
      {alert && (
        <span style={{
          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
          width: 6, height: 6, borderRadius: '50%', background: 'var(--red-500)',
          boxShadow: '0 0 6px rgba(239,68,68,0.7)',
          animation: 'pulse-soft 1.8s ease-in-out infinite',
        }} />
      )}
    </button>
  );
}

// ─── Main App
export default function App() {
  if (IS_DOCS_TAB) return <DocsStandalone />;

  const {
    pipelineStatus, executionLog, setAuth, authToken, userId,
    userPrefix, logout, resetPipeline, currentAgent,
    dqScore, dqAlerts, pipelineProgress, sessionId
  } = usePipelineStore();

  const [appView,        setAppView]        = useState('landing');
  const [showConnection, setShowConnection] = useState(false);
  const [showAuth,       setShowAuth]       = useState(false);
  const [showLog,        setShowLog]        = useState(false);
  const [activeMainView, setActiveMainView] = useState('pipeline');
  const [leftCollapsed,  setLeftCollapsed]  = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [isDarkMode,     setIsDarkMode]     = useState(true);
  const [profile,        setProfile]        = useState(null);
  const [goodbyeUser,    setGoodbyeUser]    = useState(null);

  // Auth + theme persistence
  useEffect(() => {
    const token  = localStorage.getItem('auth_token');
    const uid    = localStorage.getItem('user_id');
    const prefix = localStorage.getItem('user_prefix') || 'dw';
    if (token && uid) setAuth(token, parseInt(uid), prefix);
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') setIsDarkMode(false);
    // FIX: 'auth' n'est pas une vue valide, utiliser 'landing' avec modal auth ouvert
    if (!token) { setAppView('landing'); setShowAuth(true); }
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const handleLogout = () => {
    const name = profile?.full_name || userPrefix || 'utilisateur';
    setGoodbyeUser(name);
    setTimeout(() => {
      setGoodbyeUser(null);
      logout();
      setAppView('landing'); // FIX: 'auth' n'existe pas, utiliser 'landing'
      setShowAuth(true);
    }, 2200);
  };

  // Nav groups
  const NAV_GROUPS = [
    {
      label: 'Pipeline',
      items: [
        { id: 'pipeline',  icon: Workflow,      label: 'Pipeline',    alert: ['running','starting'].includes(pipelineStatus) },
        { id: 'architect', icon: BrainCircuit,  label: 'Inspector',   alert: pipelineStatus === 'awaiting_review' },
        { id: 'metrics',   icon: TrendingUp,    label: 'Metrics',     alert: false },
        { id: 'export',    icon: Download,      label: 'Export',      alert: pipelineStatus === 'complete' },
      ]
    },
    {
      label: 'Data',
      items: [
        { id: 'explorer',  icon: Database,      label: 'Source',      alert: false },
        { id: 'schema',    icon: Star,          label: 'Star Schema', alert: pipelineStatus === 'complete' },
        { id: 'catalog',   icon: Book,          label: 'Catalog',     alert: false },
        { id: 'lineage',   icon: GitMerge,      label: 'Lineage',     alert: false },
      ]
    },
    {
      label: 'Analytics',
      items: [
        { id: 'queries',  icon: Search,         label: 'Query',       alert: false },
        { id: 'olap',     icon: Layers,         label: 'OLAP Cube',   alert: false },
        { id: 'quality',  icon: ShieldCheck,    label: 'Quality',     alert: pipelineStatus === 'awaiting_dq_review' || (dqScore !== null && dqScore < 50) },
      ]
    },
  ];

  // Hidden-but-mounted view trick to preserve component state
  const renderView = (viewId, Component) => (
    <div
      key={viewId}
      style={{
        position: 'absolute', inset: 0,
        opacity: activeMainView === viewId ? 1 : 0,
        zIndex:  activeMainView === viewId ? 10 : 0,
        pointerEvents: activeMainView === viewId ? 'auto' : 'none',
        display: activeMainView === viewId ? 'block' : 'none',
        transition: 'opacity 0.2s',
      }}
    >
      <Suspense fallback={<Spinner />}>{Component}</Suspense>
    </div>
  );

  return (
    <div
      className="relative flex flex-col h-screen overflow-hidden"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <Suspense fallback={null}><NeuralBackground /></Suspense>
      <ToastNotifications />

      {/* Modals */}
      <AnimatePresence>
        {showConnection && <ConnectionModal isOpen onClose={() => setShowConnection(false)} />}
        {showAuth       && (
          <AuthModal
            isOpen
            onClose={() => setShowAuth(false)}
            onSuccess={() => {
              setShowAuth(false);
              setAppView('dashboard');
            }}
          />
        )}
      </AnimatePresence>

      {/* Goodbye overlay */}
      <AnimatePresence>
        {goodbyeUser && (
          <motion.div
            key="goodbye"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(20px)', background: 'rgba(6,8,16,0.88)' }}
          >
            <motion.div
              initial={{ scale: 0.88, y: 24, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 22 }}
              className="card-premium flex flex-col items-center gap-5 px-12 py-10"
            >
              <AgentBILogo size={72} variant="hero" animated />
              <motion.h2
                initial={{ letterSpacing: '0.02em' }} animate={{ letterSpacing: '0.1em' }}
                transition={{ duration: 1.2 }}
                style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase' }}
              >
                Au revoir,{' '}
                <span style={{ background: 'var(--grad-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {goodbyeUser}
                </span>
              </motion.h2>
              <p style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>
                Agent Data Warehouse · Session fermée
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View routing */}
      <AnimatePresence mode="wait">
        {appView === 'landing' && (
          <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'absolute', inset: 0, zIndex: 190 }}>
            <LandingPage
              onEnterDashboard={() => authToken ? setAppView('dashboard') : setShowAuth(true)}
              onSelectSource={() => { setAppView('dashboard'); setShowConnection(true); }}
              onAuthOpen={() => setShowAuth(true)}
              onUseCaseOpen={() => setAppView('usecases')}
              onDocsOpen={() => window.open('/?view=docs', '_blank')}
              isDarkMode={isDarkMode}
              setIsDarkMode={setIsDarkMode}
              user={authToken ? { prefix: userPrefix } : null}
            />
          </motion.div>
        )}
        {appView === 'usecases' && (
          <motion.div key="usecases" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} style={{ position: 'absolute', inset: 0, zIndex: 220, overflowY: 'auto', background: 'var(--bg-base)' }}>
            <button onClick={() => setAppView('landing')} className="btn btn-primary" style={{ position: 'fixed', top: 24, left: 24, zIndex: 230 }}>
              <ChevronLeft size={14}/> Retour
            </button>
            <Suspense fallback={null}><div style={{ paddingTop: 80, paddingBottom: 48 }}><UseCaseFlow /></div></Suspense>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dashboard */}
      {appView === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', zIndex: 10 }}>

          {/* ── Header ── */}
          <header style={{
            display: 'flex', alignItems: 'center', padding: '0 20px', height: 52, flexShrink: 0,
            background: 'rgba(10,13,26,0.92)', backdropFilter: 'blur(20px)',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            {/* Brand */}
            <button onClick={() => setAppView('landing')} style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 20, background: 'none', border: 'none', cursor: 'pointer' }}>
              <AgentBILogo size={28} variant="mark" animated />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                Agent <span style={{ background: 'var(--grad-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>DW</span>
              </span>
            </button>

            {/* Divider */}
            <div style={{ width: 1, height: 20, background: 'var(--border-subtle)', marginRight: 16 }} />

            {/* Status */}
            <StatusPill status={pipelineStatus} />
            {dqScore !== null && (
              <span style={{
                marginLeft: 8, fontSize: 10, fontWeight: 600, padding: '2px 8px',
                borderRadius: 99, color: 'var(--text-muted)',
                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)',
              }}>
                DQ {Math.round(dqScore)}%
              </span>
            )}

            {/* Right actions */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => setShowLog(!showLog)}
                title="Logs d'exécution"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, borderRadius: 7, cursor: 'pointer',
                  background: showLog ? 'rgba(61,106,232,0.15)' : 'transparent',
                  border: `1px solid ${showLog ? 'rgba(61,106,232,0.3)' : 'transparent'}`,
                  color: showLog ? 'var(--blue-300)' : 'var(--text-muted)',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!showLog) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-primary)'; }}}
                onMouseLeave={e => { if (!showLog) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}}
              >
                <Terminal size={14} />
              </button>

              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                title="Changer le thème"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, borderRadius: 7, cursor: 'pointer',
                  background: 'transparent', border: '1px solid transparent',
                  color: 'var(--text-muted)', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
              </button>

              <button
                onClick={handleLogout}
                title="Se déconnecter"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, borderRadius: 7, cursor: 'pointer',
                  background: 'transparent', border: '1px solid transparent',
                  color: 'var(--text-muted)', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = 'var(--red-400)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <LogOut size={14} />
              </button>

              <div style={{ width: 1, height: 20, background: 'var(--border-subtle)', margin: '0 4px' }} />

              <button
                onClick={() => { resetPipeline(); setShowConnection(true); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '0 14px', height: 32, borderRadius: 7, cursor: 'pointer',
                  background: 'var(--grad-primary)', color: '#fff',
                  fontSize: 12, fontWeight: 600, border: 'none',
                  boxShadow: '0 2px 12px rgba(61,106,232,0.35)',
                  transition: 'opacity 0.15s, transform 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <Play size={11} fill="currentColor" /> New Pipeline
              </button>
            </div>
          </header>

          {/* ── Body ── */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

            {/* ── Left Sidebar ── */}
            <aside style={{
              display: 'flex', flexDirection: 'column', flexShrink: 0,
              width: leftCollapsed ? 52 : 192,
              background: 'rgba(10,13,26,0.6)',
              borderRight: '1px solid var(--border-subtle)',
              transition: 'width 0.2s ease',
              overflow: 'hidden',
            }}>
              {/* Home link */}
              <div style={{ padding: '8px 0 4px' }}>
                <NavItem
                  icon={Home} label="Accueil"
                  active={false} alert={false}
                  collapsed={leftCollapsed}
                  onClick={() => setAppView('landing')}
                />
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: 'var(--border-hair)', margin: '2px 12px' }} />

              {/* Nav groups */}
              <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }} className="custom-scrollbar">
                {NAV_GROUPS.map(group => (
                  <div key={group.label}>
                    {!leftCollapsed && <NavSection label={group.label} />}
                    {leftCollapsed && <div style={{ height: 8 }} />}
                    {group.items.map(item => (
                      <NavItem
                        key={item.id}
                        icon={item.icon}
                        label={item.label}
                        active={activeMainView === item.id}
                        alert={item.alert}
                        collapsed={leftCollapsed}
                        onClick={() => setActiveMainView(item.id)}
                      />
                    ))}
                  </div>
                ))}
              </div>

              {/* Collapse toggle */}
              <button
                onClick={() => setLeftCollapsed(!leftCollapsed)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: leftCollapsed ? 'center' : 'flex-end',
                  padding: '10px 14px', cursor: 'pointer', background: 'none', border: 'none',
                  borderTop: '1px solid var(--border-hair)',
                  color: 'var(--text-dim)', transition: 'color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
                title={leftCollapsed ? 'Ouvrir le menu' : 'Réduire le menu'}
              >
                {leftCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
              </button>
            </aside>

            {/* ── Main Canvas ── */}
            <main style={{ flex: 1, position: 'relative', background: 'var(--bg-base)', overflow: 'hidden' }}>
              <ErrorBoundary>
                {renderView('pipeline',   <PipelineCanvas />)}
                {renderView('explorer',   <DataExplorer />)}
                {renderView('schema',     <StarSchemaViewer />)}
                {renderView('catalog',    <DataCatalog />)}
                {renderView('queries',    <QueryRunner />)}
                {renderView('olap',       <OlapExplorer />)}
                {renderView('quality',    <DataQualityPanel />)}
                {renderView('architect',  <ArchitectureInspector />)}
                {renderView('lineage',    <LineageGraph />)}
                {renderView('metrics',    <RunMetrics />)}
                {renderView('governance', <GovernancePanel />)}
                {renderView('export',     <ExportPanel onClose={undefined} />)}
              </ErrorBoundary>
            </main>

            {/* ── AI Sidebar ── */}
            <aside style={{
              display: 'flex', flexDirection: 'column', flexShrink: 0,
              width: rightCollapsed ? 44 : 340,
              background: 'rgba(10,13,26,0.55)',
              borderLeft: '1px solid var(--border-subtle)',
              transition: 'width 0.2s ease', overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: rightCollapsed ? 'center' : 'space-between',
                padding: rightCollapsed ? '12px 0' : '10px 14px',
                borderBottom: '1px solid var(--border-hair)', flexShrink: 0,
              }}>
                {!rightCollapsed && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={12} style={{ color: 'var(--purple-400)' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--purple-400)' }}>
                      Assistant IA
                    </span>
                  </div>
                )}
                <button
                  onClick={() => setRightCollapsed(!rightCollapsed)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 24, height: 24, borderRadius: 5, cursor: 'pointer',
                    background: 'none', border: 'none',
                    color: 'var(--text-dim)', transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
                >
                  {rightCollapsed ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
                </button>
              </div>

              {/* Chat area */}
              {!rightCollapsed && (
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <Suspense fallback={<Spinner />}>
                    {pipelineStatus?.includes('review') ? <HumanReviewPanel /> : <ChatInterface />}
                  </Suspense>
                </div>
              )}

              {/* Collapsed icon */}
              {rightCollapsed && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16, gap: 16 }}>
                  <Sparkles size={14} style={{ color: 'var(--purple-400)', opacity: 0.7 }} />
                </div>
              )}
            </aside>
          </div>

          {/* ── Log Panel ── */}
          <AnimatePresence>
            {showLog && (
              <motion.div
                key="log"
                initial={{ height: 0 }} animate={{ height: 240 }} exit={{ height: 0 }}
                style={{ borderTop: '1px solid var(--border-subtle)', background: 'rgba(6,8,16,0.92)', flexShrink: 0, overflow: 'hidden' }}
              >
                <Suspense fallback={null}><ExecutionLog onClose={() => setShowLog(false)} /></Suspense>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
