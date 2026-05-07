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
    ext:      'XLSX',
    icon:     FileSpreadsheet,
    accent:   'var(--green-500)',
    endpoint: 'export-xlsx',
    mime:     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  {
    key:      'csv',
    label:    'CSV Bundle',
    sub:      '1 fichier par table · UTF-8',
    ext:      'ZIP',
    icon:     FileArchive,
    accent:   'var(--cyan-500)',
    endpoint: 'export-csv',
    mime:     'application/zip',
  },
  {
    key:      'json',
    label:    'Structural JSON',
    sub:      'Métadonnées · DDL · Lignage',
    ext:      'JSON',
    icon:     Braces,
    accent:   'var(--blue-500)',
    endpoint: 'export-json',
    mime:     'application/json',
  },
  {
    key:      'sql',
    label:    'Logical Schema',
    sub:      'DDL T-SQL complet · Schéma étoile',
    ext:      'SQL',
    icon:     Database,
    accent:   'var(--indigo-500)',
    endpoint: null,
    mime:     'text/sql',
  },
  {
    key:      'bak',
    label:    'Backup SQL Server',
    sub:      'Snapshot du Data Warehouse',
    ext:      'BAK',
    icon:     HardDrive,
    accent:   'var(--orange-500)',
    endpoint: 'export-bak',
    mime:     'application/octet-stream',
  },
];

// ─── Export Row Card ───────────────────────────────────────────────────────────
function ExportCard({ def, loading, success, disabled, onClick }) {
  const { label, sub, ext, icon: Icon, accent } = def;
  const isLoading = loading === def.key;
  const isSuccess = success === def.key;

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || isLoading}
      aria-label={`Exporter au format ${def.label} (${def.ext})${isLoading ? ' — en cours' : ''}${isSuccess ? ' — terminé' : ''}`}
      aria-busy={isLoading}
      aria-disabled={disabled}
      whileHover={!disabled && !isLoading ? { scale: 1.01 } : {}}
      whileTap={!disabled && !isLoading ? { scale: 0.98 } : {}}
      className={`relative flex items-center gap-4 p-4 rounded-2xl border text-left transition-all overflow-hidden group
        ${disabled
          ? 'opacity-30 cursor-not-allowed'
          : 'cursor-pointer hover:brightness-105'
        }`}
      style={{
        background: 'var(--bg-elevated)',
        borderColor: 'var(--border-subtle)',
        borderLeftWidth: '3px',
        borderLeftColor: disabled ? 'var(--border-subtle)' : accent,
      }}
    >
      {/* Left: Icon */}
      <div
        className="relative w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors"
        style={{
          background: disabled ? 'var(--bg-higher)' : `${accent}15`,
          color: disabled ? 'var(--text-muted)' : accent,
        }}
      >
        {isLoading ? (
          <Loader2 size={20} className="animate-spin" />
        ) : isSuccess ? (
          <Check size={20} />
        ) : (
          <Icon size={20} />
        )}
      </div>

      {/* Center: Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p
            className="text-[12px] font-black uppercase tracking-wider truncate"
            style={{ color: disabled ? 'var(--text-muted)' : 'var(--text-primary)' }}
          >
            {label}
          </p>
          <span
            className="text-[9px] font-black font-mono px-1.5 py-0.5 rounded-md shrink-0"
            style={{
              background: disabled ? 'var(--bg-higher)' : `${accent}15`,
              color: disabled ? 'var(--text-dim)' : accent,
            }}
          >
            {ext}
          </span>
        </div>
        <p className="text-[10px] font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
          {sub}
        </p>
      </div>

      {/* Right: Arrow / State */}
      <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
        style={{
          background: isSuccess ? 'var(--green-500)' : isLoading ? 'var(--bg-higher)' : 'var(--bg-higher)',
          color: isSuccess ? '#fff' : disabled ? 'var(--text-dim)' : 'var(--text-muted)',
        }}
      >
        {isSuccess ? <Check size={14} /> : isLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
      </div>

      {/* Loading progress bar */}
      {isLoading && (
        <motion.div
          className="absolute bottom-0 left-0 h-[2px] rounded-full"
          style={{ background: accent }}
          animate={{ width: ['0%', '85%'] }}
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
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--blue-500)', color: '#fff' }}>
            <Download size={14} />
          </div>
          <div>
            <h3 className="text-[13px] font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>Exports & Livrables</h3>
            <p className="text-[9px] font-bold uppercase tracking-widest mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {sessionId ? `Session · ${sessionId.substring(0, 12)}` : 'En attente de session'}
            </p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Fermer le panneau d'export" className="p-2 rounded-xl transition-all"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-higher)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}
          >
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

        {/* Export list — single column rows */}
        <div className="flex flex-col gap-3">
          {EXPORTS.map(def => (
            <ExportCard
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
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{
            background: pipelineDone ? 'var(--green-500)' : canExport ? 'var(--orange-400)' : 'var(--text-dim)',
            animation: canExport && !pipelineDone ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
          }} />
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
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
      <div className="px-6 py-3 border-t text-center shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
        <span className="text-[8px] font-black uppercase tracking-[0.3em] font-mono" style={{ color: 'var(--text-dim)' }}>
          Agent DW v3.0 · Moteur d'Export
        </span>
      </div>
    </div>
  );
}
