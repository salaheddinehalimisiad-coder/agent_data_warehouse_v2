// src/components/FloatingChatWidget.jsx
// Widget de chat flottant style ChatGPT/Intercom :
// - Bouton circulaire en bas a droite (icone agent + animation pulse)
// - Click -> slide-in panel 400px x 640px avec glassmorphism
// - Header pro avec status + minimize/close
// - Body = ChatInterface complet
// - Touche ESC pour fermer, Esc/click outside pour minimize
import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Minus, Maximize2, Sparkles, Zap } from 'lucide-react';
import { usePipelineStore } from '../store/pipelineStore';

const ChatInterface = lazy(() => import('./ChatInterface'));

const PANEL_W = 420;
const PANEL_H = 660;

export default function FloatingChatWidget() {
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [unread, setUnread] = useState(0);
  const lastMessageCountRef = useRef(0);

  const { messages, pipelineStatus, currentAgent } = usePipelineStore();

  // Compter les nouveaux messages assistant quand le widget est ferme
  useEffect(() => {
    if (open) {
      setUnread(0);
      lastMessageCountRef.current = messages.length;
      return;
    }
    const newAssistant = messages
      .slice(lastMessageCountRef.current)
      .filter(m => m.role === 'assistant').length;
    if (newAssistant > 0) setUnread(u => u + newAssistant);
    lastMessageCountRef.current = messages.length;
  }, [messages, open]);

  // ESC pour fermer
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && open) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const isWorking = pipelineStatus === 'running' || pipelineStatus === 'starting';
  const hasReview = pipelineStatus === 'awaiting_review' || pipelineStatus === 'awaiting_dq_review';

  return (
    <>
      {/* ─── Bouton flottant ────────────────────────────────────────── */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="fab"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 24 }}
            whileHover={{ scale: 1.08, y: -2 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => setOpen(true)}
            aria-label="Ouvrir l'Assistant IA"
            style={{
              position: 'fixed', right: 24, bottom: 24, zIndex: 9990,
              width: 60, height: 60, borderRadius: '50%',
              border: '1px solid rgba(139,92,246,0.35)',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%)',
              boxShadow: '0 8px 32px rgba(139,92,246,0.45), 0 0 0 1px rgba(255,255,255,0.06) inset',
              color: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {/* Glow pulsant en arriere-plan */}
            <motion.div
              animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                position: 'absolute', inset: -8, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(139,92,246,0.6), transparent 70%)',
                pointerEvents: 'none',
              }}
            />
            {/* Icone */}
            <Bot size={26} strokeWidth={2.2} style={{ position: 'relative', zIndex: 2 }} />

            {/* Badge unread */}
            <AnimatePresence>
              {unread > 0 && (
                <motion.span
                  initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                  style={{
                    position: 'absolute', top: -4, right: -4,
                    minWidth: 22, height: 22, padding: '0 6px', borderRadius: 11,
                    background: '#ef4444', color: 'white',
                    fontSize: 11, fontWeight: 800, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(239,68,68,0.5)',
                    border: '2px solid #0a0a0f',
                  }}
                >
                  {unread > 9 ? '9+' : unread}
                </motion.span>
              )}
            </AnimatePresence>

            {/* Indicateur "en cours" */}
            {isWorking && (
              <motion.span
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                style={{
                  position: 'absolute', bottom: 2, right: 2,
                  width: 12, height: 12, borderRadius: '50%',
                  background: '#10b981', border: '2px solid #0a0a0f',
                }}
              />
            )}

            {/* Indicateur "review" */}
            {hasReview && !isWorking && (
              <span
                style={{
                  position: 'absolute', bottom: 2, right: 2,
                  width: 12, height: 12, borderRadius: '50%',
                  background: '#f59e0b', border: '2px solid #0a0a0f',
                  animation: 'pulse 1.5s infinite',
                }}
              />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* ─── Backdrop quand ouvert ────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 9980,
              background: 'rgba(0,0,0,0.32)', backdropFilter: 'blur(4px)',
            }}
          />
        )}
      </AnimatePresence>

      {/* ─── Panel chat ─────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="atlas-title"
            aria-describedby="atlas-status"
            initial={{ opacity: 0, y: 32, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed', zIndex: 9991,
              right: maximized ? 24 : 24,
              bottom: maximized ? 24 : 24,
              top: maximized ? 24 : 'auto',
              left: maximized ? 24 : 'auto',
              width: maximized ? 'auto' : PANEL_W,
              height: maximized ? 'auto' : PANEL_H,
              maxWidth: '100vw', maxHeight: '100vh',
              borderRadius: 18,
              background: 'linear-gradient(180deg, rgba(15,17,32,0.98) 0%, rgba(8,9,18,0.98) 100%)',
              border: '1px solid rgba(139,92,246,0.18)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 64px rgba(139,92,246,0.12)',
              overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              backdropFilter: 'blur(24px)',
            }}
          >
            {/* Header */}
            <header style={{
              flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 18px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              background: 'linear-gradient(180deg, rgba(99,102,241,0.08), transparent)',
            }}>
              {/* Avatar agent */}
              <div style={{
                position: 'relative', width: 36, height: 36, borderRadius: 12,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #d946ef)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(139,92,246,0.35)',
              }}>
                <Bot size={20} color="white" strokeWidth={2.2} />
                {/* Status dot */}
                <span style={{
                  position: 'absolute', bottom: -2, right: -2,
                  width: 12, height: 12, borderRadius: '50%',
                  background: isWorking ? '#10b981' : hasReview ? '#f59e0b' : '#10b981',
                  border: '2px solid rgba(15,17,32,0.98)',
                  animation: (isWorking || hasReview) ? 'pulse 1.5s infinite' : 'none',
                }} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 id="atlas-title" style={{
                  margin: 0, fontSize: 15, fontWeight: 700, color: 'white',
                  letterSpacing: '-0.02em',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  Atlas
                  <Sparkles size={11} style={{ color: '#a78bfa' }} aria-hidden="true" />
                </h3>
                <p id="atlas-status" role="status" aria-live="polite" style={{
                  margin: 0, fontSize: 10, color: '#94a3b8',
                  letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <span style={{
                    display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
                    background: isWorking ? '#10b981' : hasReview ? '#f59e0b' : '#10b981',
                  }} />
                  {isWorking
                    ? `${currentAgent || 'pipeline'} en cours...`
                    : hasReview ? 'En attente de votre validation' : 'Architecte ETL · disponible'}
                </p>
              </div>

              {/* Boutons header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  onClick={() => setMaximized(m => !m)}
                  title={maximized ? 'Reduire' : 'Plein ecran'}
                  style={btnStyle}
                >
                  {maximized ? <Minus size={14} /> : <Maximize2 size={14} />}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  title="Fermer (Esc)"
                  style={btnStyle}
                >
                  <X size={16} />
                </button>
              </div>
            </header>

            {/* Body : ChatInterface existant */}
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <Suspense fallback={
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: '100%', color: '#a78bfa', gap: 8,
                }}>
                  <Zap size={14} className="animate-pulse" />
                  <span style={{ fontSize: 11, fontWeight: 600 }}>Chargement…</span>
                </div>
              }>
                <ChatInterface />
              </Suspense>
            </div>

            {/* Footer micro-info */}
            <footer style={{
              flexShrink: 0, padding: '6px 18px',
              borderTop: '1px solid rgba(255,255,255,0.04)',
              fontSize: 9, color: '#64748b',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700,
            }}>
              <span>ATLAS · ETL Architect</span>
              <span style={{ color: '#a78bfa' }}>BLAZE GLM-5</span>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Animation pulse globale (CSS) */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.15); }
        }
      `}</style>
    </>
  );
}

const btnStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: 8,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.06)',
  color: '#cbd5e1', cursor: 'pointer',
  transition: 'all 0.15s ease',
};
