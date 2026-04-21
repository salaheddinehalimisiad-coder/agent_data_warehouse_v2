// src/App.jsx — Application v3.0 SP1 — Ultra-Premium Redesigned Layout
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Terminal, LogOut, Database, ChevronLeft, ChevronRight,
  Settings, Activity, Sparkles, ShieldCheck, Star, GitMerge,
  BrainCircuit, Zap, Sun, Moon, Book, Lock, Home, User
} from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import ToastNotifications, { addToast } from './components/ToastNotifications';
import AgentBILogo from './components/AgentBILogo';

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
const ProfilePage       = React.lazy(() => import('./components/ProfilePage'));
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
    pipelineStatus, executionLog, setAuth, authToken, userId,
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
  const [showProfile,     setShowProfile]    = useState(false);
  const [avatarBust,      setAvatarBust]     = useState(Date.now());
  const [hasAvatar,       setHasAvatar]      = useState(false);
  const [profile,         setProfile]        = useState(null); // { full_name, email, … }
  const [goodbyeUser,     setGoodbyeUser]    = useState(null); // nom affiché sur l'animation d'au revoir
  const [welcomeUser,     setWelcomeUser]    = useState(null); // nom affiché sur l'animation de bienvenue
  const welcomedRef       = useRef(false);
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

    // AUTH GATE — aucun jeton ? On bascule sur l'écran de login dédié.
    // C'est la toute première chose que voit l'utilisateur à l'ouverture.
    if (!token) {
      setAppView('auth');
      setShowAuth(true);
    }
  }, []);

  // Écoute la déconnexion forcée (token invalide/expiré) émise par apiClient.
  useEffect(() => {
    const onUnauthorized = () => {
      logout();
      setAppView('auth');
      setShowAuth(true);
    };
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, [logout]);

  // Si on quitte l'auth (déconnexion) pendant qu'on est sur le dashboard,
  // on revient sur l'écran de login.
  useEffect(() => {
    if (!authToken && appView === 'dashboard') {
      setAppView('auth');
      setShowAuth(true);
    }
  }, [authToken, appView]);

  // Après une connexion réussie depuis l'écran de login, on bascule sur la
  // landing page (overview de l'app) puis on ferme le modal d'auth.
  useEffect(() => {
    if (authToken && appView === 'auth') {
      setShowAuth(false);
      setAppView('landing');
    }
  }, [authToken, appView]);

  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    document.documentElement.classList.toggle('light-mode', !isDarkMode);
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  // Profil : charge les infos utilisateur + avatar à chaque changement de token.
  useEffect(() => {
    if (!authToken) {
      setHasAvatar(false);
      setProfile(null);
      welcomedRef.current = false;
      return;
    }
    let alive = true;
    apiClient.getProfile()
      .then(p => {
        if (!alive) return;
        setProfile(p || null);
        setHasAvatar(!!p?.has_avatar);
        setAvatarBust(Date.now());
        // Splash « Bonjour <nom> » plein écran — même comportement que le splash
        // de logout (centré, animé, 2.2s) pour une symétrie parfaite arrivée/départ.
        if (!welcomedRef.current) {
          welcomedRef.current = true;
          const displayName = (p?.full_name || (p?.email ? p.email.split('@')[0] : '')) || userPrefix || 'utilisateur';
          setWelcomeUser(displayName);
          setTimeout(() => setWelcomeUser(null), 2200);
        }
      })
      .catch(() => { if (alive) { setHasAvatar(false); setProfile(null); } });
    return () => { alive = false; };
  }, [authToken, userPrefix]);

  // Quand on ferme la page profil, on rafraîchit la miniature (cache-bust).
  const handleProfileClose = () => {
    setShowProfile(false);
    setAvatarBust(Date.now());
    apiClient.getProfile().then(p => setHasAvatar(!!p?.has_avatar)).catch(() => {});
  };

  // Déconnexion avec animation "Au revoir <nom>" pleine page.
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
            onClose={() => {
              // Verrou : tant qu'on n'a pas de token valide, le modal ne peut
              // pas être fermé. Force l'utilisateur à s'authentifier.
              if (authToken) setShowAuth(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Splash "Au revoir" (animation de logout) ───────────────────────── */}
      <AnimatePresence>
        {goodbyeUser && (
          <motion.div
            key="goodbye"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] flex items-center justify-center backdrop-blur-xl"
            style={{ background: 'rgba(6,8,17,0.85)' }}
          >
            <motion.div
              initial={{ scale: 0.85, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="flex flex-col items-center gap-4 px-10 py-8 rounded-3xl border shadow-2xl"
              style={{ background: 'linear-gradient(140deg, rgba(79,70,229,0.25), rgba(147,51,234,0.18))', borderColor: 'rgba(255,255,255,0.08)' }}
            >
              <div className="relative drop-shadow-[0_8px_30px_rgba(139,92,246,0.35)]">
                <AgentBILogo size={80} variant="hero" animated />
              </div>
              <motion.h2
                initial={{ letterSpacing: '0.02em' }} animate={{ letterSpacing: '0.12em' }}
                transition={{ duration: 1.4, ease: 'easeOut' }}
                className="text-3xl md:text-4xl font-black tracking-widest text-white uppercase"
              >
                Good bye, <span className="gradient-text">{goodbyeUser}</span>
              </motion.h2>
              <p className="text-[12px] font-mono text-slate-400">À bientôt sur Agent BI ✨</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Splash "Bonjour" (animation de login) ───────────────────────────── */}
      {/* Même comportement que le splash goodbye : centré, 2.2s, même box. */}
      <AnimatePresence>
        {welcomeUser && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] flex items-center justify-center backdrop-blur-xl"
            style={{ background: 'rgba(6,8,17,0.85)' }}
          >
            <motion.div
              initial={{ scale: 0.85, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="flex flex-col items-center gap-4 px-10 py-8 rounded-3xl border shadow-2xl"
              style={{ background: 'linear-gradient(140deg, rgba(79,70,229,0.25), rgba(147,51,234,0.18))', borderColor: 'rgba(255,255,255,0.08)' }}
            >
              <div className="relative drop-shadow-[0_8px_30px_rgba(139,92,246,0.35)]">
                <AgentBILogo size={80} variant="hero" animated />
              </div>
              <motion.h2
                initial={{ letterSpacing: '0.02em' }} animate={{ letterSpacing: '0.12em' }}
                transition={{ duration: 1.4, ease: 'easeOut' }}
                className="text-3xl md:text-4xl font-black tracking-widest text-white uppercase"
              >
                Bonjour, <span className="gradient-text">{welcomeUser}</span>
              </motion.h2>
              <p className="text-[12px] font-mono text-slate-400">Content de vous revoir sur Agent BI ✨</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Écran de Login (première page à l'ouverture, sans backend auth) ── */}
      <AnimatePresence>
        {appView === 'auth' && !authToken && (
          <motion.div
            key="auth-screen"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-[180] flex items-center justify-center"
            style={{ background: 'radial-gradient(ellipse at center, rgba(79,70,229,0.18), rgba(6,8,17,0.95) 65%)' }}
          >
            <div className="flex flex-col items-center gap-6 text-center px-8">
              <div className="relative drop-shadow-[0_10px_40px_rgba(139,92,246,0.4)]">
                <AgentBILogo size={96} variant="hero" animated />
              </div>
              <div className="space-y-2">
                <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">
                  Agent <span className="gradient-text">BI</span>
                </h1>
                <p className="text-[13px] text-slate-400 max-w-md">
                  Plateforme ETL multi-agents. Connectez-vous ou créez un compte pour commencer.
                </p>
              </div>
              <button
                onClick={() => setShowAuth(true)}
                className="btn btn-primary gap-2 px-6 py-2.5 text-[12px]"
              >
                <LogOut size={14} className="rotate-180" />
                Se connecter / S'inscrire
              </button>
              <p className="text-[11px] font-mono text-slate-600 mt-2">v5.0 · Premium Dark</p>
            </div>
          </motion.div>
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
              onEnterDashboard={() => {
                // Gate d'authentification : pas de token ? On ouvre l'auth.
                if (!authToken) { setShowAuth(true); return; }
                setAppView('dashboard');
              }}
              onSelectSource={() => {
                if (!authToken) { setShowAuth(true); return; }
                setAppView('dashboard');
                setShowConnection(true);
              }}
              onAuthOpen={() => setShowAuth(true)}
              onDocsOpen={() => window.open('/docs/index.html', '_blank', 'noopener,noreferrer')}
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

        {showProfile && (
          <motion.div key="profile" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="absolute inset-0 z-[210]">
             <ErrorBoundary>
               <Suspense fallback={null}>
                 <ProfilePage onBack={handleProfileClose} />
               </Suspense>
             </ErrorBoundary>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Dashboard Layout ───────────────────────────────────────────── */}
      {appView === 'dashboard' && !showSettings && !showProfile && (
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
            {/* Brand — logo premium Agent BI + dot live */}
            <button
              onClick={() => setAppView('landing')}
              className="flex items-center gap-3 mr-6 group transition-transform hover:scale-[1.02] active:scale-[0.98]"
              title="Retour à l'accueil"
            >
              <div className="relative shrink-0">
                <AgentBILogo size={38} variant="mark" animated />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse-soft ring-2 ring-ink-950" />
              </div>
              <div className="leading-tight text-left">
                <h1 className="text-[14px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  Agent <span className="gradient-text">BI</span>
                </h1>
                <p className="text-[10px] font-mono text-slate-500 leading-none mt-0.5">v5.0 · Premium Dark</p>
              </div>
            </button>

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
                <button
                  onClick={() => setShowProfile(true)}
                  className="relative flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border transition-all duration-300 hover:scale-[1.02] shadow-sm mx-1"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}
                  title="Mon profil"
                >
                  <span className="relative w-7 h-7 rounded-full overflow-hidden flex items-center justify-center shrink-0" style={{ background: 'var(--bg-base)' }}>
                    {hasAvatar && userId ? (
                      <img
                        src={apiClient.getAvatarUrl(userId, avatarBust)}
                        alt="Avatar"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <User size={14} className="text-slate-400" />
                    )}
                  </span>
                  <span className="hidden md:flex flex-col items-start leading-tight">
                    <span className="text-[11px] font-semibold text-slate-200 max-w-[140px] truncate">
                      {profile?.full_name || (profile?.email ? profile.email.split('@')[0] : (userPrefix || 'Mon compte'))}
                    </span>
                    <span className="text-[9px] font-mono text-slate-500 max-w-[140px] truncate">
                      {profile?.email || ''}
                    </span>
                  </span>
                </button>
              )}

              {authToken && (
                <button onClick={handleLogout} className="btn btn-ghost btn-icon" title="Se déconnecter">
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
                {/* ── Home — retour à la landing page ─────────────────────────── */}
                <button
                  onClick={() => setAppView('landing')}
                  title="Accueil"
                  className="flex items-center gap-3 mx-3 mb-2 px-3 py-3 rounded-xl transition-all font-medium whitespace-nowrap overflow-hidden shrink-0 text-indigo-300 hover:text-white hover:bg-indigo-500/20 border border-indigo-500/20 hover:border-indigo-400/40"
                >
                  <Home size={18} className="shrink-0" />
                  {!leftCollapsed && <span className="text-[12px] uppercase tracking-widest font-black">Accueil</span>}
                </button>
                <div className="mx-3 my-1 border-t" style={{ borderColor: 'var(--border-subtle)' }} />

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
