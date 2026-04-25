// src/components/ExecutionLog.jsx — Collapsible Technical Terminal v4.1
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, X, ChevronDown, ChevronUp, Trash2, CheckCircle2, AlertCircle, AlertTriangle, Wrench, Search, Copy, Download } from 'lucide-react';
import { usePipelineStore } from '../store/pipelineStore';

const LOG_PATTERNS = [
  { test: l => l.includes('❌') || l.includes('ERROR') || l.includes('CRITICAL'), type: 'error',   cls: 'text-rose-400',    dot: 'bg-rose-500'    },
  { test: l => l.includes('✅') || l.includes('succès') || l.includes('success'),  type: 'success', cls: 'text-emerald-400', dot: 'bg-emerald-500' },
  { test: l => l.includes('⚠️') || l.includes('DÉRIVE') || l.includes('drift'),   type: 'warn',    cls: 'text-amber-400',   dot: 'bg-amber-500'   },
  { test: l => l.includes('🔧') || l.includes('Healer'),                            type: 'heal',    cls: 'text-orange-400',  dot: 'bg-orange-500'  },
  { test: l => l.includes('🚀') || l.includes('Pipeline'),                          type: 'info',    cls: 'text-indigo-400',  dot: 'bg-indigo-500'  },
];

function getStyle(line) {
  for (const p of LOG_PATTERNS) {
    if (p.test(line)) return p;
  }
  return { type: 'default', cls: 'text-slate-500', dot: 'bg-slate-700' };
}

export default function ExecutionLog({ onClose }) {
  const { executionLog, healHistory } = usePipelineStore();
  const bottomRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter]   = useState('all');
  const [search, setSearch]   = useState('');
  const [copied, setCopied]   = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(executionLog.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([executionLog.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `execution_log_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [executionLog, autoScroll]);

  const stats = {
    errors:  executionLog.filter(l => l.includes('❌') || l.includes('ERROR')).length,
    warns:   executionLog.filter(l => l.includes('⚠️')).length,
    success: executionLog.filter(l => l.includes('✅')).length,
  };

  const filtered = (
    filter === 'errors'  ? executionLog.filter(l => getStyle(l).type === 'error') :
    filter === 'success' ? executionLog.filter(l => getStyle(l).type === 'success') :
    executionLog
  ).filter(l => !search || l.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] border-t border-white/[0.06]">
      
      {/* Header */}
      <div className="flex items-center justify-between px-5 h-11 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-3">
          <Terminal size={13} className="text-slate-600" />
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Execution Log</span>
          <span className="text-[10px] font-mono text-slate-600 bg-white/[0.04] px-2 py-0.5 rounded-md border border-white/[0.06]">
            {executionLog.length} events
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick filter pills */}
          <div className="flex gap-1 text-[9px] font-black">
            {['all','errors','success'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-2 py-0.5 rounded-lg border transition-all uppercase tracking-wider"
                style={filter === f
                  ? { color: 'var(--blue-300)', background: 'rgba(61,106,232,0.1)', borderColor: 'rgba(61,106,232,0.25)' }
                  : { color: 'var(--text-dim)', borderColor: 'rgba(255,255,255,0.06)' }
                }
              >{f}</button>
            ))}
          </div>

          <div className="w-px h-4 bg-white/[0.08] mx-1" />

          {/* Copy & Download */}
          <button
            onClick={handleCopy}
            title="Copier les logs"
            className="p-1.5 text-slate-600 hover:text-slate-300 transition-colors rounded-lg hover:bg-white/[0.04] text-[10px] font-semibold"
          >
            {copied ? <CheckCircle2 size={13} className="text-emerald-400" /> : <Copy size={13} />}
          </button>
          <button
            onClick={handleDownload}
            title="Télécharger les logs"
            className="p-1.5 text-slate-600 hover:text-slate-300 transition-colors rounded-lg hover:bg-white/[0.04]"
          >
            <Download size={13} />
          </button>

          <div className="w-px h-4 bg-white/[0.08] mx-1" />

          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll(v => !v)}
            className="text-[10px] font-semibold px-2 py-0.5 rounded-md border transition-all"
            style={autoScroll
              ? { color: 'var(--blue-300)', background: 'rgba(61,106,232,0.1)', borderColor: 'rgba(61,106,232,0.2)' }
              : { color: 'var(--text-muted)', borderColor: 'rgba(255,255,255,0.06)' }
            }
          >
            {autoScroll ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>

          {onClose && (
            <button onClick={onClose} className="p-1 text-slate-600 hover:text-slate-400 transition-colors rounded-lg hover:bg-white/[0.04]">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2 px-5 py-2 border-b border-white/[0.04] shrink-0">
        <Search size={11} className="text-slate-700 shrink-0" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher dans les logs..."
          className="flex-1 bg-transparent text-[11px] text-slate-400 font-mono placeholder:text-slate-700 outline-none"
        />
        {search && (
          <span className="text-[9px] text-indigo-400 font-bold">{filtered.length} rés.</span>
        )}
      </div>

      {/* Log feed */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-0.5 custom-scrollbar font-mono text-[11px]">
        {filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <span className="text-slate-700 font-sans text-[11px]">No events yet — awaiting pipeline ignition</span>
          </div>
        ) : (
          <>
            {filtered.map((line, i) => {
              const s = getStyle(line);
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-start gap-3 py-1 group"
                >
                  <span className="text-slate-700 shrink-0 w-8 text-right select-none">{i + 1}</span>
                  <div className={`w-1 h-1 rounded-full ${s.dot} mt-[5px] shrink-0`} />
                  <span className={`leading-relaxed ${s.cls} break-words`}>{line}</span>
                </motion.div>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Healer section (only if needed) */}
      <AnimatePresence>
        {healHistory?.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-orange-500/[0.12] bg-orange-500/[0.03] shrink-0 overflow-hidden"
          >
            <div className="px-5 py-2 flex items-center gap-2">
              <Wrench size={12} className="text-orange-400" />
              <span className="text-[10px] font-semibold text-orange-400 uppercase tracking-wider">
                Self-Heal Log — {healHistory.length} interventions
              </span>
            </div>
            <div className="max-h-20 overflow-y-auto px-5 pb-2 space-y-1 custom-scrollbar">
              {healHistory.map((h, i) => (
                <div key={i} className="font-mono text-[10px] text-orange-300/50 leading-relaxed">
                  <span className="text-orange-500/30 mr-2">H{i + 1}</span>{h}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

