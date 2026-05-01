// src/components/ExportPanel.jsx — Icon Grid v4.0 (5 exports only)
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileSpreadsheet, FileArchive, Braces, Database, HardDrive,
  Check, Loader2, AlertTriangle, X, Download,
} from 'lucide-react';
import { usePipelineStore } from '../store/pipelineStore';
import { apiClient } from '../api/client';

// ─── The 5 export definitions ────────────────────────────────────────────────
const EXPORTS = [
  {
    key:      'xlsx',
    label:    'Rapport Excel',
    sub:      '10 feuilles · KPI · Mesures · Charts',
    ext:      '.xlsx',
    icon:     FileSpreadsheet,
    color:    { bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', icon: 'text-emerald-400', glow: '#10b981' },
    endpoint: 'export-xlsx',
    mime:     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  {
    key:      'csv',
    label:    'CSV Bundle',
    sub:      '1 fichier par table · UTF-8',
    ext:      '.zip',
    icon:     FileArchive,
    color:    { bg: 'bg-cyan-500/10', border: 'border-cyan-500/25', icon: 'text-cyan-400', glow: '#06b6d4' },
    endpoint: 'export-csv',
    mime:     'application/zip',
  },
  {
    key:      'json',
    label:    'Structural JSON',
    sub:      'Métadonnées · DDL · Lignage',
    ext:      '.json',
    icon:     Braces,
    color:    { bg: 'bg-indigo-500/10', border: 'border-indigo-500/25', icon: 'text-indigo-400', glow: '#6366f1' },
    endpoint: 'export-json',
    mime:     'application/json',
  },
  {
    key:      'sql',
    label:    'Logical Schema',
    sub:      'DDL T-SQL complet · Schéma étoile',
    ext:      '.sql',
    icon:     Database,
    color:    { bg: 'bg-violet-500/10', border: 'border-violet-500/25', icon: 'text-violet-400', glow: '#8b5cf6' },
    endpoint: null, // local download from store
    mime:     'text/sql',
  },
  {
    key:      'bak',
    label:    'Backup SQL Server',
    sub:      'Snapshot du Data Warehouse',
    ext:      '.bak',
    icon:     HardDrive,
    color:    { bg: 'bg-amber-500/10', border: 'border-amber-500/25', icon: 'text-amber-400', glow: '#f59e0b' },
    endpoint: 'export-bak',
    mime:     'application/octet-stream',
  },
];

// ─── Icon Card ────────────────────────────────────────────────────────────────
function IconCard({ def, loading, success, disabled, onClick }) {
  const { label, sub, ext, icon: Icon, color } = def;
  const isLoading = loading === def.key;
  const isSuccess = success === def.key;

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || isLoading}
      whileHover={!disabled && !isLoading ? { scale: 1.03, y: -2 } : {}}
      whileTap={!disabled && !isLoading ? { scale: 0.97 } : {}}
      className={`relative flex flex-col items-center justify-center gap-3 p-6 rounded-3xl border transition-all overflow-hidden group
        ${disabled
          ? 'opacity-25 grayscale border-white/5 cursor-not-allowed'
          : `${color.bg} ${color.border} hover:shadow-lg cursor-pointer`
        }`}
      style={!disabled ? { boxShadow: isSuccess ? `0 0 20px ${color.glow}40` : undefined } : undefined}
    >
      {/* Glow pulse on success */}
      {isSuccess && (
        <motion.div
          initial={{ opacity: 0.6, scale: 0.8 }}
          animate={{ opacity: 0, scale: 2 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0 rounded-3xl"
          style={{ background: `radial-gradient(circle, ${color.glow}30, transparent)` }}
        />
      )}

      {/* Icon container */}
      <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center border transition-all
        ${isSuccess ? 'bg-emerald-500 border-emerald-400' : `${color.bg} ${color.border} group-hover:scale-110`}`}
        style={{ transition: 'transform 0.2s ease' }}
      >
        {isLoading ? (
          <Loader2 size={22} className="animate-spin text-white" />
        ) : isSuccess ? (
          <Check size={22} className="text-white" />
        ) : (
          <Icon size={22} className={color.icon} />
        )}
      </div>

      {/* Labels */}
      <div className="text-center space-y-0.5">
        <p className={`text-[12px] font-black uppercase tracking-wider ${disabled ? 'text-slate-600' : 'text-white'}`}>
          {label}
        </p>
        <p className="text-[9px] text-slate-500 font-medium">{sub}</p>
      </div>

      {/* Extension badge */}
      <span className={`text-[8px] font-black font-mono px-2 py-0.5 rounded-full border ${color.bg} ${color.border} ${color.icon}`}>
        {ext}
      </span>

      {/* Loading progress bar */}
      {isLoading && (
        <motion.div
          className="absolute bottom-0 left-0 h-0.5 rounded-full"
          style={{ background: color.glow }}
          animate={{ width: ['0%', '90%'] }}
          transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity }}
        />
      )}
    </motion.button>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function ExportPanel({ onClose }) {
  const { sessionId, pipelineStatus, etlStatus, userPrefix, sqlDDL } = usePipelineStore();
  const [loading, setLoading] = useState(null);
  const [success, setSuccess] = useState(null);
  const [error,   setError]   = useState('');

  const canExport   = !!sessionId;
  const pipelineDone = pipelineStatus === 'complete' || etlStatus === 'success';

  const flash = (key) => {
    setSuccess(key);
    setTimeout(() => setSuccess(null), 3000);
  };

  const download = async (def) => {
    if (!sessionId) return;
    setError('');

    // Local SQL download (no API call)
    if (def.key === 'sql') {
      if (!sqlDDL) { setError('DDL SQL non encore généré'); return; }
      const blob = new Blob([sqlDDL], { type: 'text/sql' });
      const url  = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `schema_${userPrefix}_${sessionId.substring(0, 8)}.sql`;
      a.click();
      URL.revokeObjectURL(url);
      flash('sql');
      return;
    }

    // API-based downloads
    setLoading(def.key);
    try {
      const base = import.meta.env.VITE_API_URL || '';
      const resp = await fetch(`${base}/api/${def.endpoint}?session_id=${sessionId}`, {
        headers: apiClient.getHeaders(),
      });
      if (!resp.ok) {
        // Tenter d'extraire un message d'erreur lisible
        let detail = '';
        try {
          const j = await resp.json();
          detail = j.detail || j.message || '';
        } catch {
          try { detail = await resp.text(); } catch { /* noop */ }
        }
        throw new Error(`HTTP ${resp.status}${detail ? ` — ${detail.substring(0, 220)}` : ''}`);
      }

      const blob = await resp.blob();
      if (!blob || blob.size === 0) {
        throw new Error('Réponse vide — le fichier n\'a pas été généré');
      }
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;

      // Build filename
      const prefix = userPrefix || 'dw';
      const sid    = sessionId.substring(0, 8);
      const names  = {
        xlsx: `rapport_${prefix}_${sid}.xlsx`,
        csv:  `csv_bundle_${prefix}_${sid}.zip`,
        json: `archive_${prefix}_${sid}.json`,
        bak:  `${prefix}_dw_${sid}.bak`,
      };
      a.download = names[def.key] || `export_${def.key}`;
      // Important : insérer dans le DOM avant click pour Firefox/Safari
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // Si le serveur a indiqué que c'est un backup logique, le signaler à l'utilisateur
      if (def.key === 'bak') {
        const backupType = resp.headers.get('X-Backup-Type');
        if (backupType === 'logical-zip') {
          setError('ℹ️ SQL Server indisponible — backup logique téléchargé (ZIP renommé .bak avec DDL + CSV).');
        }
      }
      flash(def.key);
    } catch (e) {
      setError(`${def.label} : ${e.message}`);
    } finally {
      setLoading(null);
    }
  };

  const isDisabled = (def) => {
    if (!canExport) return true;
    // .bak and .sql require pipeline done
    if ((def.key === 'bak' || def.key === 'sql') && !pipelineDone) return true;
    return false;
  };

  return (
    <div className="h-full flex flex-col bg-[#050508] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Download size={14} className="text-indigo-400" />
          </div>
          <div>
            <h3 className="text-[13px] font-black text-white uppercase tracking-tight">Exports & Livrables</h3>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
              {sessionId ? `Session · ${sessionId.substring(0, 12)}` : 'En attente de session'}
            </p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-2 rounded-xl text-slate-600 hover:text-white bg-white/5 hover:bg-white/10 transition-all">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
        {!canExport && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 text-amber-400 text-[10px] font-bold uppercase tracking-widest"
          >
            <AlertTriangle size={14} className="shrink-0 animate-pulse" />
            Démarrez un pipeline pour activer les exports
          </motion.div>
        )}

        {/* Icon grid — 2 columns */}
        <div className="grid grid-cols-2 gap-4">
          {EXPORTS.map(def => (
            <IconCard
              key={def.key}
              def={def}
              loading={loading}
              success={success}
              disabled={isDisabled(def)}
              onClick={() => download(def)}
            />
          ))}
        </div>

        {/* Status info */}
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${pipelineDone ? 'bg-emerald-500' : canExport ? 'bg-amber-500 animate-pulse' : 'bg-slate-700'}`} />
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
            {pipelineDone
              ? 'Pipeline complet — tous les exports disponibles'
              : canExport
              ? 'Pipeline en cours — Excel, CSV et JSON disponibles'
              : 'En attente du pipeline'}
          </span>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
              className="flex items-start gap-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold"
            >
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
              <button onClick={() => setError('')} className="ml-auto shrink-0 hover:opacity-70"><X size={12} /></button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-white/5 text-center">
        <span className="text-[8px] font-black text-slate-800 uppercase tracking-[0.3em] font-mono">
          Agent DW v3.0 · Export Engine
        </span>
      </div>
    </div>
  );
}
