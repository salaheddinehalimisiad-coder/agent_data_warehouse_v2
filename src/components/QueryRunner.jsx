// src/components/QueryRunner.jsx — Jupyter-style Query Runner
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Database, ChevronDown, ChevronUp, Download, AlertCircle, CheckCircle2, Loader2, BarChart3 } from 'lucide-react';
import { usePipelineStore } from '../store/pipelineStore';

const TYPE_COLOR = {
  kpi:          'bg-amber-500/10  border-amber-500/30  text-amber-400',
  trend:        'bg-cyan-500/10   border-cyan-500/30   text-cyan-400',
  top_n:        'bg-purple-500/10 border-purple-500/30 text-purple-400',
  distribution: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  comparison:   'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
  detail:       'bg-slate-500/10  border-slate-500/30  text-slate-400',
};

function ResultTable({ result }) {
  if (result.error) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 mt-3">
        <AlertCircle size={14} className="text-rose-400 mt-0.5 shrink-0" />
        <span className="text-[11px] text-rose-300 font-mono">{result.error}</span>
      </div>
    );
  }
  if (!result.rows || result.rows.length === 0) {
    return <div className="mt-3 text-[11px] text-slate-500 italic">Aucun résultat retourné.</div>;
  }

  const exportCSV = () => {
    const header = result.columns.join(',');
    const rows   = result.rows.map(r => r.map(v => `"${v ?? ''}"`).join(','));
    const blob   = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a');
    a.href       = url;
    a.download   = `${result.title || 'query'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 rounded-xl border border-white/[0.06] overflow-hidden"
    >
      {/* Result header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/[0.03] border-b border-white/5">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={11} className="text-emerald-400" />
          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">
            {result.rows.length} ligne{result.rows.length > 1 ? 's' : ''}
          </span>
          <span className="text-[9px] text-slate-600">·</span>
          <span className="text-[9px] font-black text-slate-500 uppercase">{result.columns.length} colonnes</span>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 hover:text-white px-2 py-1 rounded-lg hover:bg-white/5 transition-all uppercase tracking-wider"
        >
          <Download size={10} /> CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto custom-scrollbar max-h-64">
        <table className="w-full text-left border-collapse text-[11px]">
          <thead className="sticky top-0">
            <tr className="bg-[#0d0d14]">
              {result.columns.map(col => (
                <th key={col} className="px-3 py-2 font-black text-slate-400 border-r border-white/5 last:border-0 uppercase tracking-tight whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, i) => (
              <tr key={i} className={`border-b border-white/[0.03] ${i % 2 === 0 ? 'bg-white/[0.01]' : ''} hover:bg-indigo-500/[0.04] transition-colors`}>
                {row.map((val, j) => (
                  <td key={j} className="px-3 py-2 text-slate-300 whitespace-nowrap border-r border-white/[0.03] last:border-0 font-mono">
                    {val === null || val === undefined ? <span className="text-slate-700 italic">null</span> : String(val)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function QueryCell({ query, result, index, onRun, isRunning }) {
  const [showSQL, setShowSQL]     = useState(false);
  const [showResult, setShowResult] = useState(!!result);
  const typeClass = TYPE_COLOR[query.type] || TYPE_COLOR.detail;

  const handlePlay = async () => {
    setShowResult(true);
    await onRun(query, index);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
    >
      {/* Cell header */}
      <div className="flex items-start gap-4 p-5">
        {/* Index badge */}
        <div className="shrink-0 w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <span className="text-[10px] font-black text-indigo-400">{index + 1}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[13px] font-black text-white">{query.title}</span>
            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${typeClass}`}>
              {query.type}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">{query.description}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowSQL(s => !s)}
            className="flex items-center gap-1 text-[9px] font-black text-slate-600 hover:text-slate-300 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-all uppercase tracking-wider"
          >
            SQL {showSQL ? <ChevronUp size={10}/> : <ChevronDown size={10}/>}
          </button>
          <button
            onClick={handlePlay}
            disabled={isRunning}
            className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-xl border transition-all ${
              isRunning
                ? 'border-slate-700 bg-slate-800/60 text-slate-500 cursor-not-allowed'
                : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-400/60 hover:shadow-lg hover:shadow-emerald-500/10'
            }`}
          >
            {isRunning
              ? <><Loader2 size={12} className="animate-spin"/> Running</>
              : <><Play size={12} fill="currentColor"/> Run</>
            }
          </button>
        </div>
      </div>

      {/* SQL block */}
      <AnimatePresence>
        {showSQL && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <pre className="px-5 pb-4 text-[11px] font-mono text-indigo-300 bg-black/30 border-t border-white/[0.04] leading-relaxed overflow-x-auto custom-scrollbar">
              {query.sql}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      {showResult && result && (
        <div className="px-5 pb-5">
          <ResultTable result={result} />
        </div>
      )}
    </motion.div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function QueryRunner() {
  const { generatedQueries, queryResults, sessionId } = usePipelineStore();
  const [liveResults, setLiveResults] = useState({});
  const [running, setRunning]         = useState({});

  const queries = generatedQueries || [];
  const preloaded = queryResults   || [];

  const getResult = (index) => liveResults[index] ?? preloaded[index] ?? null;

  const handleRun = async (query, index) => {
    setRunning(r => ({ ...r, [index]: true }));
    try {
      const res = await fetch(`/api/execute-query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ sql: query.sql, session_id: sessionId }),
      });
      const data = await res.json();
      setLiveResults(r => ({
        ...r,
        [index]: {
          ...query,
          columns: data.columns || [],
          rows:    data.rows    || [],
          error:   data.error   || null,
        }
      }));
    } catch (e) {
      setLiveResults(r => ({
        ...r,
        [index]: { ...query, columns: [], rows: [], error: String(e) }
      }));
    } finally {
      setRunning(r => ({ ...r, [index]: false }));
    }
  };

  if (queries.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 opacity-40">
        <BarChart3 size={32} className="text-slate-600" />
        <div className="text-center">
          <p className="text-[12px] font-black text-slate-500 uppercase tracking-widest">Aucune requête disponible</p>
          <p className="text-[10px] text-slate-600 mt-1">Les requêtes analytiques seront générées après un run complet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#050508] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <BarChart3 size={15} className="text-amber-400" />
          </div>
          <div>
            <h2 className="text-[13px] font-black text-white">Query Runner</h2>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
              {queries.length} requête{queries.length > 1 ? 's' : ''} analytique{queries.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Database size={13} className="text-slate-600" />
          <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">OLAP · SQL Server</span>
        </div>
      </div>

      {/* Cells */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
        {queries.map((query, i) => (
          <QueryCell
            key={i}
            query={query}
            result={getResult(i)}
            index={i}
            onRun={handleRun}
            isRunning={!!running[i]}
          />
        ))}
      </div>
    </div>
  );
}
