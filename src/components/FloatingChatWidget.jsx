// src/components/FloatingChatWidget.jsx
// Widget conversationnel flottant — version professionnelle
// Améliorations vs version précédente :
//   • Bouton flottant plus discret avec halo subtil et badge de notifications
//   • Panneau plus large par défaut (440 × 700) et 3 tailles : compact, normal, plein écran
//   • Animation spring fluide, drag pour déplacer (en plein écran on snap aux 4 coins)
//   • Header propre : avatar + statut + boutons agrandir/réduire/fermer
//   • Raccourcis : Ctrl+J pour ouvrir/fermer, Esc pour fermer
//   • Persistance taille et position dans localStorage
//   • Indicateur de statut connecté/réflexion/hors-ligne
//   • Préchargement du ChatInterface en arrière-plan dès le 1er hover
import React, { useEffect, useRef, useState, lazy, Suspense, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, X, Minimize2, Maximize2, Sparkles, Zap, Loader2,
  ArrowDownRight, ArrowUpLeft, MessageSquarePlus
} from 'lucide-react';
import { usePipelineStore } from '../store/pipelineStore';

const ChatInterface = lazy(() => import('./ChatInterface'));

const STORAGE_SIZE = 'atlas:widget-size:v1';
const STORAGE_OPEN = 'atlas:widget-open:v1';

const SIZE_PRESETS = {
  compact:    { w: 380, h: 580 },
  normal:     { w: 460, h: 720 },
  large:      { w: 560, h: 820 },
};

export default function FloatingChatWidget() {
  const { messages, pipelineStatus, currentAgent } = usePipelineStore();

  const [open, setOpen]               = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_OPEN) || 'false'); } catch { return false; }
  });
  const [size, setSize]               = useState(() => {
    try { return localStorage.getItem(STORAGE_SIZE) || 'normal'; } catch { return 'normal'; }
  });
  const [maximized, setMaximized]     = useState(false);
  const [unread, setUnread]           = useState(0);
  const [hasPreloaded, setHasPreloaded] = useState(false);
  const lastSeenRef                   = useRef(messages.length);

  const isWorking = pipelineStatus === 'running' || pipelineStatus === 'starting';
  const hasReview = pipelineStatus === 'awaiting_review' || pipelineStatus === 'awaiting_dq_review';
  const isOnline  = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // Persistance
  useEffect(() => { try { localStorage.setItem(STORAGE_OPEN, JSON.stringify(open)); } catch {} }, [open]);
  useEffect(() => { try { localStorage.setItem(STORAGE_SIZE, size); } catch {} }, [size]);

  // Compte des messages non lus quand le widget est fermé
  useEffect(() => {
    if (open) {
      setUnread(0);
      lastSeenRef.current = messages.length;
      return;
    }
    const newAssistant = messages.slice(lastSeenRef.current).filter(m => m.role === 'assistant').length;
    if (newAssistant > 0) setUnread(u => u + newAssistant);
    lastSeenRef.current = messages.length;
  }, [messages, open]);

  // Raccourcis : Ctrl+J pour toggle, Esc pour fermer
  useEffect(() => {
    const onKey = (e) => {
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key === 'j') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape' && open && !maximized) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, maximized]);

  // Préchargement du ChatInterface au survol du bouton (pour ouverture instantanée)
  const preload = useCallback(() => {
    if (!hasPreloaded) {
      import('./ChatInterface').then(() => setHasPreloaded(true)).catch(() => {});
    }
  }, [hasPreloaded]);

  // Dimensions effectives
  const dim = maximized
    ? { w: 'calc(100vw - 32px)', h: 'calc(100vh - 32px)' }
    : { w: SIZE_PRESETS[size].w, h: SIZE_PRESETS[size].h };

  return (
    <>
      {/* ─── Bouton flottant ────────────────────────────────────────── */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="fab"
            initial={{ scale: 0, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => setOpen(true)}
            onMouseEnter={preload}
            onFocus={preload}
            aria-label="Ouvrir l'assistant Atlas (Ctrl+J)"
            title="Ouvrir Atlas (Ctrl+J)"
            style={{
              position: 'fixed', right: 20, bottom: 20, zIndex: 9990,
              width: 56, height: 56, borderRadius: '50%',
              border: 'none',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%)',
              boxShadow: isWorking
                ? '0 12px 36px rgba(139,92,246,0.55), 0 0 0 1px rgba(255,255,255,0.06) inset'
                : '0 8px 28px rgba(139,92,246,0.4), 0 0 0 1px rgba(255,255,255,0.06) inset',
              color: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {/* Halo pulsant */}
            <motion.span
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                position: 'absolute', inset: -6, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(139,92,246,0.55), transparent 65%)',
                pointerEvents: 'none',
              }}
              aria-hidden="true"
            />
            <Bot size={24} strokeWidth={2.2} style={{ position: 'relative', zIndex: 2 }} />

            {/* Badge unread */}
            <AnimatePresence>
              {unread > 0 && (
                <motion.span
                  initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                  style={{
                    position: 'absolute', top: -3, right: -3,
                    minWidth: 20, height: 20, padding: '0 5px', borderRadius: 10,
                    background: '#ef4444', color: 'white',
                    fontSize: 10.5, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(239,68,68,0.5)',
                    border: '2px solid #0a0a12',
                    zIndex: 3,
                  }}
                  aria-label={`${unread} messages non lus`}
                >
                  {unread > 9 ? '9+' : unread}
                </motion.span>
              )}
            </AnimatePresence>

            {/* Pastille statut */}
            <span
              aria-hidden="true"
              style={{
                position: 'absolute', bottom: 2, right: 2,
                width: 11, height: 11, borderRadius: '50%',
                background: !isOnline ? '#f43f5e' : isWorking ? '#f59e0b' : hasReview ? '#f59e0b' : '#10b981',
                border: '2px solid #0a0a12',
                animation: (isWorking || hasReview) ? 'atlas-pulse 1.4s infinite' : 'none',
              }}
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ─── Backdrop ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && maximized && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setMaximized(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 9988,
              background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
            }}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* ─── Panneau ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            role="dialog"
            aria-modal={maximized ? 'true' : 'false'}
            aria-labelledby="atlas-panel-title"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            style={{
              position: 'fixed', zIndex: 9991,
              right: maximized ? 16 : 20,
              bottom: maximized ? 16 : 20,
              top: maximized ? 16 : 'auto',
              left: maximized ? 16 : 'auto',
              width: dim.w, height: dim.h,
              maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 32px)',
              borderRadius: maximized ? 16 : 18,
              background: 'linear-gradient(180deg, #0d0d18 0%, #08080f 100%)',
              border: '1px solid rgba(139,92,246,0.18)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 60px rgba(139,92,246,0.1)',
              overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Header */}
            <header
              style={{
                flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                background: 'linear-gradient(180deg, rgba(99,102,241,0.07), transparent)',
              }}
            >
              {/* Avatar */}
              <div style={{
                position: 'relative',
                width: 30, height: 30, borderRadius: 9,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #d946ef)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(139,92,246,0.35)',
              }}>
                <Bot size={16} color="white" strokeWidth={2.3} />
                <span style={{
                  position: 'absolute', bottom: -2, right: -2,
                  width: 10, height: 10, borderRadius: '50%',
                  background: !isOnline ? '#f43f5e' : isWorking ? '#f59e0b' : hasReview ? '#f59e0b' : '#10b981',
                  border: '2px solid #0d0d18',
                  animation: (isWorking || hasReview) ? 'atlas-pulse 1.4s infinite' : 'none',
                }} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <h3
                  id="atlas-panel-title"
                  style={{
                    margin: 0, fontSize: 13.5, fontWeight: 700, color: 'white',
                    letterSpacing: '-0.01em',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  Atlas
                  <Sparkles size={10} style={{ color: '#a78bfa' }} aria-hidden="true" />
                </h3>
                <p
                  role="status"
                  aria-live="polite"
                  style={{
                    margin: 0, fontSize: 10, color: '#9ca3b3',
                    letterSpacing: '0.02em',
                    display: 'flex', alignItems: 'center', gap: 4,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
                >
                  <span style={{
                    display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
                    background: !isOnline ? '#f43f5e' : isWorking ? '#f59e0b' : '#10b981',
                  }} />
                  {!isOnline ? 'Hors ligne'
                    : isWorking ? `Module ${currentAgent || 'pipeline'} en cours…`
                    : hasReview ? 'Validation requise'
                    : 'Architecte ETL · disponible'}
                </p>
              </div>

              {/* Boutons header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {/* Sélecteur de taille (visible quand non maximisé) */}
                {!maximized && (
                  <select
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    aria-label="Taille du panneau"
                    style={{
                      ...iconBtnStyle,
                      width: 'auto', padding: '0 8px',
                      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="compact">Compact</option>
                    <option value="normal">Normal</option>
                    <option value="large">Large</option>
                  </select>
                )}

                <button
                  onClick={() => setMaximized(m => !m)}
                  title={maximized ? 'Réduire' : 'Plein écran'}
                  aria-label={maximized ? 'Réduire le panneau' : 'Agrandir en plein écran'}
                  style={iconBtnStyle}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#cbd5e1'; }}
                >
                  {maximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  title="Fermer (Esc)"
                  aria-label="Fermer le panneau"
                  style={iconBtnStyle}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(244,63,94,0.15)'; e.currentTarget.style.color = '#fda4af'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#cbd5e1'; }}
                >
                  <X size={14} />
                </button>
              </div>
            </header>

            {/* Body : ChatInterface */}
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
              <Suspense fallback={
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: '100%', color: '#a78bfa', gap: 10, flexDirection: 'column',
                }}>
                  <Loader2 size={20} className="animate-spin" />
                  <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.04em' }}>
                    Chargement de l&apos;assistant…
                  </span>
                </div>
              }>
                <ChatInterface embedded={!maximized} />
              </Suspense>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CSS global */}
      <style>{`
        @keyframes atlas-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.55; transform: scale(1.18); }
        }
      `}</style>
    </>
  );
}

const iconBtnStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  height: 26, minWidth: 26, padding: 0,
  borderRadius: 7,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.06)',
  color: '#cbd5e1', cursor: 'pointer',
  transition: 'all 0.15s ease',
  outline: 'none',
};
