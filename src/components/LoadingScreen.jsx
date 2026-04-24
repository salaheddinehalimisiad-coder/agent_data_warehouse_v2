// src/components/LoadingScreen.jsx — Splash / Accueil animé
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const AGENT_NODES = [
  { id: 'explorer',       label: 'Explorer',       emoji: '🔍', delay: 0.1 },
  { id: 'drift',          label: 'Drift Detector',  emoji: '🌊', delay: 0.2 },
  { id: 'modeler',        label: 'Modeler',         emoji: '🧠', delay: 0.3 },
  { id: 'critic',         label: 'Critic',          emoji: '🛡️', delay: 0.4 },
  { id: 'human_review',   label: 'Human Review',    emoji: '👤', delay: 0.5 },
  { id: 'chat_modifier',  label: 'Chat Modifier',   emoji: '💬', delay: 0.6 },
  { id: 'etl_tsql_generator', label: 'ETL Generator',   emoji: '⚙️', delay: 0.7 },
  { id: 'etl_executor',   label: 'ETL Executor',    emoji: '🚀', delay: 0.8 },
  { id: 'healer',         label: 'Healer',          emoji: '🔧', delay: 0.9 },
];

const FEATURES = [
  { icon: '🧠', title: 'IA Multi-Agents', desc: 'Pipeline LangGraph complet' },
  { icon: '🌊', title: 'Schema Drift', desc: 'Détection automatique' },
  { icon: '👤', title: 'Human-in-the-Loop', desc: 'Validation interactive' },
  { icon: '🚀', title: 'ETL Pentaho', desc: 'Génération .ktr intelligente' },
];

export default function LoadingScreen({ onComplete }) {
  const [phase, setPhase] = useState('intro'); // intro | ready
  const [activeNode, setActiveNode] = useState(0);

  // Cycle through nodes to show pipeline flow
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveNode(n => (n + 1) % AGENT_NODES.length);
    }, 600);
    return () => clearInterval(timer);
  }, []);

  // After 1.5s, switch to ready state
  useEffect(() => {
    const t = setTimeout(() => setPhase('ready'), 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 bg-[#06060a] flex flex-col items-center justify-center overflow-hidden z-50">
      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-indigo-600/5 blur-[120px]" />
        <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] rounded-full bg-violet-600/5 blur-[80px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[200px] h-[200px] rounded-full bg-blue-600/5 blur-[60px]" />

        {/* Grid pattern */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#6366f1" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center max-w-3xl w-full px-8">

        {/* Logo / Brand */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="flex flex-col items-center mb-10"
        >
          {/* Logo icon */}
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 20 L16 12 L24 20 L32 12" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 28 L16 20 L24 28 L32 20" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
                <circle cx="8" cy="20" r="2.5" fill="#6366f1"/>
                <circle cx="24" cy="20" r="2.5" fill="#6366f1"/>
                <circle cx="16" cy="12" r="2.5" fill="#818cf8"/>
                <circle cx="32" cy="12" r="2.5" fill="#818cf8"/>
                <circle cx="16" cy="28" r="2" fill="#4f46e5" opacity="0.7"/>
                <circle cx="32" cy="28" r="2" fill="#4f46e5" opacity="0.7"/>
              </svg>
            </div>
            {/* Pulse rings */}
            <div className="absolute inset-0 rounded-2xl border border-indigo-500/20 animate-ping opacity-30" />
          </div>

          <h1 className="text-4xl font-black tracking-tight text-white mb-1" style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif", letterSpacing: '-0.02em' }}>
            Agent Data Warehouse
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest font-mono">Version</span>
            <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full font-mono">v3.0</span>
          </div>
          <p className="text-sm text-zinc-500 mt-3 text-center max-w-md leading-relaxed">
            Pipeline IA multi-agents pour la modélisation et l'automatisation de Data Warehouses
          </p>
        </motion.div>

        {/* Animated Pipeline Nodes */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="w-full mb-10"
        >
          <p className="text-center text-[11px] text-zinc-600 uppercase tracking-widest font-mono mb-4">Pipeline d'agents</p>
          <div className="flex items-center justify-center flex-wrap gap-2">
            {AGENT_NODES.map((node, i) => (
              <motion.div
                key={node.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: node.delay, duration: 0.3 }}
              >
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold font-mono transition-all duration-300 ${
                    activeNode === i
                      ? 'bg-indigo-600/30 border-indigo-500/60 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.3)]'
                      : activeNode === (i + 1) % AGENT_NODES.length
                        ? 'bg-zinc-800/60 border-zinc-600/40 text-zinc-400'
                        : 'bg-zinc-900/60 border-zinc-800/40 text-zinc-600'
                  }`}
                >
                  <span className="text-sm leading-none">{node.emoji}</span>
                  <span>{node.label}</span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Flow line */}
          <div className="flex items-center justify-center mt-4 gap-0">
            {AGENT_NODES.map((_, i) => (
              <div key={i} className="flex items-center">
                <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  activeNode === i ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]' : 'bg-zinc-800'
                }`} />
                {i < AGENT_NODES.length - 1 && (
                  <div className={`h-px w-8 transition-all duration-300 ${
                    activeNode === i ? 'bg-indigo-500/50' : 'bg-zinc-800'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </motion.div>


        {/* CTA Button */}
        <AnimatePresence>
          {phase === 'ready' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              <button
                onClick={onComplete}
                className="group relative px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm rounded-2xl transition-all duration-200 hover:shadow-[0_0_40px_rgba(99,102,241,0.5)] hover:scale-105 active:scale-95 z-50 pointer-events-auto"
                style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}
              >
                <span className="relative z-10 flex items-center gap-3">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 8H13M10 5L13 8L10 11" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Lancer l'application
                </span>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                <span className="absolute inset-0 rounded-2xl flex items-center justify-center font-black text-sm text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 gap-3" style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 8H13M10 5L13 8L10 11" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Lancer l'application
                </span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === 'ready' ? 0.4 : 0 }}
          transition={{ delay: 0.5 }}
          className="text-[10px] text-zinc-600 mt-6 font-mono text-center"
        >
          Propulsé par LangGraph · Claude AI · React · FastAPI
        </motion.p>
      </div>
    </div>
  );
}
