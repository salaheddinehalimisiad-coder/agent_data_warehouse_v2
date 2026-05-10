// src/App.jsx
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Terminal, LogOut, Database, ChevronLeft, ChevronRight, ChevronDown,
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
const FloatingChatWidget = React.lazy(() => import('./components/FloatingChatWidget'));
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

// ─── Error Boundary (temporaire pour debug)
class DocsErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('DocsErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, color: 'white', background: '#09090b', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h2 style={{ color: '#ef4444', marginBottom: 20 }}>DocumentationPage crashed:</h2>
          <pre style={{ background: '#111', padding: 20, borderRadius: 8, overflow: 'auto', fontSize: 13, lineHeight: 1.6 }}>
            {this.state.error?.toString?.() || 'Unknown error'}
            {'\n'}
            {this.state.error?.stack || ''}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Docs standalone
const IS_DOCS_TAB = new URLSearchParams(window.location.search).get('view') === 'docs';
function DocsStandalone() {
  const handleBack = () => {
    window.location.href = window.location.pathname;
  };
  return (
    <div className="min-h-screen overflow-y-auto" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <Suspense fallback={<Spinner />}>
        <DocsErrorBoundary>
          <DocumentationPage onBack={handleBack} />
        </DocsErrorBoundary>
      </Suspense>
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
  const [headerDark,     setHeaderDark]     = useState(true);
  const [profile,        setProfile]        = useState(null);
  const [goodbyeUser,    setGoodbyeUser]    = useState(null);
  const [welcomeUser,    setWelcomeUser]    = useState(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

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
    document.documentElement.classList.toggle('light-mode', !isDarkMode);
  }, [isDarkMode]);

  const handleLogout = () => {
    const name = profile?.full_name || userPrefix || 'utilisateur';
    setProfileMenuOpen(false);
    setGoodbyeUser(name);
    setTimeout(() => {
      setGoodbyeUser(null);
      logout();
      setProfile(null);
      setAppView('landing');
      setShowAuth(true);
    }, 2200);
  };

  const handleWelcomeDismiss = () => {
    setWelcomeUser(null);
  };

  // Fetch profile on auth
  useEffect(() => {
    if (!authToken) { setProfile(null); return; }
    let alive = true;
    apiClient.getProfile().then(p => alive && setProfile(p)).catch(() => {});
    return () => { alive = false; };
  }, [authToken]);

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
              // Fetch profile then show welcome
              apiClient.getProfile().then(p => {
                setProfile(p);
                setWelcomeUser(p?.full_name || p?.email?.split('@')[0] || 'Utilisateur');
              }).catch(() => {
                setWelcomeUser('Utilisateur');
              });
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
                Agent BI · Session fermée
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Welcome overlay */}
      <AnimatePresence>
        {welcomeUser && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleWelcomeDismiss}
            style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(20px)', background: 'rgba(6,8,16,0.88)', cursor: 'pointer' }}
          >
            <motion.div
              initial={{ scale: 0.88, y: 24, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 22 }}
              onClick={e => e.stopPropagation()}
              className="card-premium flex flex-col items-center gap-5 px-12 py-10"
              style={{ cursor: 'default' }}
            >
              <AgentBILogo size={72} variant="hero" animated />
              <motion.h2
                initial={{ letterSpacing: '0.02em' }} animate={{ letterSpacing: '0.06em' }}
                transition={{ duration: 1.2 }}
                style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}
              >
                Bonjour,{' '}
                <span style={{ background: 'var(--grad-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {welcomeUser}
                </span>
              </motion.h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 280 }}>
                Bienvenue sur <strong>Agent BI</strong>. Votre plateforme de Data Warehouse intelligente est prête.
              </p>
              <button
                onClick={handleWelcomeDismiss}
                style={{ marginTop: 8, padding: '8px 24px', borderRadius: 8, background: 'var(--grad-primary)', color: '#fff', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 2px 12px rgba(61,106,232,0.35)' }}
              >
                Continuer
              </button>
              <motion.div
                initial={{ width: 0 }} animate={{ width: '100%' }}
                transition={{ duration: 3, ease: 'linear' }}
                style={{ height: 2, background: 'var(--blue-400)', borderRadius: 1, marginTop: 4 }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View routing */}
      <AnimatePresence mode="wait">
        {appView === 'landing' && (
          <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'absolute', inset: 0, zIndex: 190, overflowY: 'auto' }}>
            <LandingPage
              onEnterDashboard={() => authToken ? setAppView('dashboard') : setShowAuth(true)}
              onSelectSource={() => { setAppView('dashboard'); setShowConnection(true); }}
              onAuthOpen={() => setShowAuth(true)}
              onLogout={handleLogout}
              onProfile={() => { setAppView('dashboard'); setActiveMainView('profile'); }}
              onUseCaseOpen={() => setAppView('usecases')}
              onDocsOpen={() => window.open('/?view=docs', '_blank')}
              isDarkMode={isDarkMode}
              setIsDarkMode={setIsDarkMode}
              user={authToken ? { prefix: userPrefix } : null}
              profile={profile}
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
            background: headerDark ? 'var(--bg-elevated)' : '#ffffff',
            backdropFilter: 'blur(20px)',
            borderBottom: `1px solid ${headerDark ? 'var(--border-subtle)' : '#e2e8f0'}`,
          }}>
            {/* Brand */}
            <button onClick={() => setAppView('landing')} style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 20, background: 'none', border: 'none', cursor: 'pointer' }}>
              <AgentBILogo size={28} variant="mark" animated />
              <span style={{ fontSize: 13, fontWeight: 700, color: headerDark ? 'var(--text-primary)' : '#1e293b', letterSpacing: '-0.02em' }}>
                Agent <span style={{ background: 'var(--grad-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>BI</span>
              </span>
            </button>

            {/* Divider */}
            <div style={{ width: 1, height: 20, background: headerDark ? 'var(--border-subtle)' : '#e2e8f0', marginRight: 16 }} />

            {/* Status */}
            <StatusPill status={pipelineStatus} />
            {dqScore !== null && (
              <span style={{
                marginLeft: 8, fontSize: 10, fontWeight: 600, padding: '2px 8px',
                borderRadius: 99, color: headerDark ? 'var(--text-muted)' : '#64748b',
                background: headerDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9', border: `1px solid ${headerDark ? 'var(--border-subtle)' : '#e2e8f0'}`,
              }}>
                DQ {Math.round(dqScore)}%
              </span>
            )}

            {/* Right actions */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Log toggle — hidden on profile */}
              {activeMainView !== 'profile' && (
                <button
                  onClick={() => setShowLog(v => !v)}
                  title={showLog ? 'Masquer le log' : 'Afficher le log'}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 32, height: 32, borderRadius: 7, cursor: 'pointer',
                    background: showLog ? 'var(--violet-500-15)' : 'transparent',
                    border: `1px solid ${showLog ? 'var(--violet-500-30)' : headerDark ? 'var(--border-default)' : '#e2e8f0'}`,
                    color: showLog ? 'var(--violet-300)' : headerDark ? 'var(--text-muted)' : '#64748b',
                    transition: 'all 0.15s',
                  }}
                >
                  <Terminal size={14} />
                </button>
              )}

              {/* Theme toggle — hidden on profile */}
              {activeMainView !== 'profile' && (
                <button
                  onClick={() => setIsDarkMode(v => !v)}
                  title={isDarkMode ? 'Mode clair' : 'Mode sombre'}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 32, height: 32, borderRadius: 7, cursor: 'pointer',
                    background: 'transparent',
                    border: `1px solid ${headerDark ? 'var(--border-default)' : '#e2e8f0'}`,
                    color: headerDark ? 'var(--text-muted)' : '#64748b',
                    transition: 'all 0.15s',
                  }}
                >
                  {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
                </button>
              )}

              {/* Profile dropdown */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setProfileMenuOpen(v => !v)}
                  title="Profil"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
                    background: headerDark ? 'var(--bg-higher)' : '#f1f5f9', border: `1px solid ${headerDark ? 'var(--border-default)' : '#e2e8f0'}`,
                    color: headerDark ? 'var(--text-primary)' : '#1e293b', transition: 'all 0.15s',
                    overflow: 'hidden',
                  }}
                >
                  {profile?.has_avatar ? (
                    <img src={apiClient.getAvatarUrl(profile.user_id)} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 700 }}>
                      {(profile?.full_name || profile?.email || 'U').split(/\s+|@/).map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}
                    </span>
                  )}
                </button>

                {profileMenuOpen && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={() => setProfileMenuOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      style={{
                        position: 'absolute', top: 40, right: 0, zIndex: 210,
                        minWidth: 200, borderRadius: 12,
                        background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)', overflow: 'hidden',
                      }}
                    >
                      {/* User info */}
                      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-hair)' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {profile?.full_name || profile?.email?.split('@')[0] || 'Utilisateur'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{profile?.email}</div>
                      </div>
                      {/* Actions */}
                      <button
                        onClick={() => { setProfileMenuOpen(false); setActiveMainView('profile'); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px',
                          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
                          fontSize: 12, fontWeight: 500, textAlign: 'left', transition: 'all 0.1s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                      >
                        <User size={14} /> Modifier le profil
                      </button>
                      <button
                        onClick={handleLogout}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px',
                          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red-400)',
                          fontSize: 12, fontWeight: 500, textAlign: 'left', transition: 'all 0.1s',
                          borderTop: '1px solid var(--border-hair)',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <LogOut size={14} /> Se déconnecter
                      </button>
                    </motion.div>
                  </>
                )}
              </div>

              <div style={{ width: 1, height: 20, background: headerDark ? 'var(--border-subtle)' : '#e2e8f0', margin: '0 4px' }} />

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
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

            {/* ── Left Sidebar ── */}
            {activeMainView !== 'profile' && (
            <aside style={{
              display: 'flex', flexDirection: 'column', flexShrink: 0,
              width: leftCollapsed ? 52 : 192,
              background: 'var(--bg-surface)',
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
            )}

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
                {renderView('profile',    <ProfilePage onBack={() => setAppView('landing')} />)}
              </ErrorBoundary>
            </main>

            {/* ── Sidebar HumanReview (visible UNIQUEMENT pendant la pause de validation) ── */}
            {pipelineStatus?.includes('review') && (
              <aside style={{
                display: 'flex', flexDirection: 'column', flexShrink: 0,
                width: rightCollapsed ? 44 : 360,
                background: 'rgba(10,13,26,0.65)',
                borderLeft: '1px solid var(--border-subtle)',
                transition: 'width 0.2s ease', overflow: 'hidden',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: rightCollapsed ? 'center' : 'space-between',
                  padding: rightCollapsed ? '12px 0' : '10px 14px',
                  borderBottom: '1px solid var(--border-hair)', flexShrink: 0,
                }}>
                  {!rightCollapsed && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkles size={12} style={{ color: '#f59e0b' }} />
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#f59e0b' }}>
                        Validation requise
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

                {!rightCollapsed && (
                  <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
                    <Suspense fallback={<Spinner />}>
                      <HumanReviewPanel />
                    </Suspense>
                  </div>
                )}
              </aside>
            )}
          </div>

          {/* ── Log Panel ── */}
          <AnimatePresence>
            {showLog && activeMainView !== 'profile' && (
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

      {/* ── Atlas floating chat — only after pipeline starts ── */}
      {activeMainView !== 'profile' && appView === 'dashboard' && pipelineStatus !== 'idle' && (
        <Suspense fallback={null}>
          <FloatingChatWidget />
        </Suspense>
      )}
    </div>
  );
}
