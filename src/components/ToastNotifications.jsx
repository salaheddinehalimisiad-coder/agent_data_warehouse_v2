// src/components/ToastNotifications.jsx — Système de Notifications Toast Temps Réel
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, AlertCircle, Info, AlertTriangle,
  X, Zap, Bot, ShieldCheck
} from 'lucide-react';
import { usePipelineStore } from '../store/pipelineStore';

const TOAST_CONFIG = {
  success: {
    icon: CheckCircle2,
    color: 'text-emerald-400',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/10',
    glow: 'shadow-emerald-500/10',
  },
  error: {
    icon: AlertCircle,
    color: 'text-rose-400',
    border: 'border-rose-500/30',
    bg: 'bg-rose-500/10',
    glow: 'shadow-rose-500/10',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-400',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10',
    glow: 'shadow-amber-500/10',
  },
  info: {
    icon: Info,
    color: 'text-indigo-400',
    border: 'border-indigo-500/30',
    bg: 'bg-indigo-500/10',
    glow: 'shadow-indigo-500/10',
  },
  agent: {
    icon: Bot,
    color: 'text-purple-400',
    border: 'border-purple-500/30',
    bg: 'bg-purple-500/10',
    glow: 'shadow-purple-500/10',
  },
};

const AGENT_MESSAGES = {
  explorer:        { msg: 'Explorer — Analyse des métadonnées source lancée',     type: 'agent' },
  data_quality:    { msg: 'Data Quality — Audit d\'intégrité en cours...',         type: 'agent' },
  drift_detector:  { msg: 'Drift Detector — Vérification des dérives de schéma',  type: 'agent' },
  modeler:         { msg: 'Modeler — Conception du Star Schema OLAP',              type: 'agent' },
  critic:          { msg: 'Critic — Audit qualité du modèle logique',              type: 'agent' },
  human_review:    { msg: '👤 En attente de votre validation — vérifiez le schéma !', type: 'warning' },
  chat_modifier:   { msg: 'Chat Modifier — Application de vos modifications...',  type: 'agent' },
  etl_tsql_generator: { msg: 'ETL Generator — Génération du fichier Pentaho .ktr',   type: 'agent' },
  etl_executor:    { msg: 'ETL Executor — Chargement des données en cours...',    type: 'agent' },
  healer:          { msg: 'Healer — Auto-correction SQL détectée et appliquée',   type: 'warning' },
  lineage_tracker: { msg: 'Lineage Tracker — Traçabilité source→DW générée',     type: 'success' },
};

let toastId = 0;

function Toast({ toast, onClose }) {
  const cfg = TOAST_CONFIG[toast.type] || TOAST_CONFIG.info;
  const Icon = cfg.icon;

  useEffect(() => {
    const timer = setTimeout(onClose, toast.duration || 5000);
    return () => clearTimeout(timer);
  }, [onClose, toast.duration]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={`
        relative flex items-start gap-3 px-4 py-3 rounded-2xl
        border backdrop-blur-xl shadow-xl max-w-[320px] w-full group cursor-pointer
        ${cfg.bg} ${cfg.border} ${cfg.glow}
      `}
      onClick={onClose}
    >
      <div className={`shrink-0 mt-0.5 ${cfg.color}`}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="text-[11px] font-black text-white uppercase tracking-wider mb-0.5">{toast.title}</p>
        )}
        <p className="text-[11px] text-slate-300 leading-relaxed font-medium">{toast.message}</p>
      </div>
      <button
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-slate-300"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      >
        <X size={12} />
      </button>

      {/* Progress bar */}
      <motion.div
        className={`absolute bottom-0 left-0 h-0.5 rounded-full ${cfg.color.replace('text-', 'bg-')}`}
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: (toast.duration || 5000) / 1000, ease: 'linear' }}
      />
    </motion.div>
  );
}

// Global add-toast function (accessible outside React)
let _addToast = null;
export function addToast(message, type = 'info', title = '', duration = 5000) {
  _addToast?.({ id: ++toastId, message, type, title, duration });
}

export default function ToastNotifications() {
  const [toasts, setToasts] = useState([]);
  const { pipelineStatus, currentAgent, etlStatus } = usePipelineStore();
  const prevAgent = useRef(null);
  const prevStatus = useRef(null);
  const prevEtlStatus = useRef(null);

  // Wire up global addToast
  useEffect(() => {
    _addToast = (t) => setToasts(prev => [...prev.slice(-4), t]); // Max 5 toasts
    return () => { _addToast = null; };
  }, []);

  const push = (message, type = 'info', title = '', duration = 5000) => {
    setToasts(prev => [...prev.slice(-4), { id: ++toastId, message, type, title, duration }]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // React to agent changes
  useEffect(() => {
    if (!currentAgent || currentAgent === prevAgent.current) return;
    prevAgent.current = currentAgent;
    const cfg = AGENT_MESSAGES[currentAgent];
    if (cfg) push(cfg.msg, cfg.type, '', 4000);
  }, [currentAgent]);

  // React to pipeline status changes
  useEffect(() => {
    if (pipelineStatus === prevStatus.current) return;
    prevStatus.current = pipelineStatus;

    if (pipelineStatus === 'complete') {
      push('Pipeline terminé avec succès ! Vos artefacts sont prêts.', 'success', '✅ Succès', 7000);
    } else if (pipelineStatus === 'error') {
      push('Une erreur est survenue. Consultez les logs pour les détails.', 'error', '⚠️ Erreur Pipeline', 8000);
    } else if (pipelineStatus === 'awaiting_review') {
      push('Validation requise — Examinez le schéma OLAP généré et approuvez ou modifiez.', 'warning', '👤 Human Review', 0);
    } else if (pipelineStatus === 'awaiting_dq_review') {
      push('Score de qualité faible détecté — vérifiez le rapport Data Quality.', 'error', '🛡️ DQ Alert', 0);
    }
  }, [pipelineStatus]);

  // React to ETL status
  useEffect(() => {
    if (etlStatus === prevEtlStatus.current) return;
    prevEtlStatus.current = etlStatus;

    if (etlStatus === 'success') {
      push('ETL chargement terminé — données insérées en Data Warehouse.', 'success', '🚀 ETL', 6000);
    } else if (etlStatus === 'failed') {
      push('ETL échoué — le Healer va tenter une auto-correction...', 'warning', '🔧 Auto-Heal', 6000);
    }
  }, [etlStatus]);

  return (
    <div
      className="fixed top-20 z-[500] flex flex-col gap-2 pointer-events-none"
      style={{
        left: pipelineStatus?.includes('review') ? 56 : 'auto',
        right: pipelineStatus?.includes('review') ? 'auto' : 16,
      }}
    >
      <AnimatePresence mode="sync">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <Toast toast={t} onClose={() => removeToast(t.id)} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
