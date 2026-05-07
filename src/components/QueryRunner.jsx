// src/components/QueryRunner.jsx — Query Runner v2.0 avec diagnostics
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Database, ChevronDown, ChevronUp, Download, AlertCircle,
  CheckCircle2, Loader2, BarChart3, RefreshCw, Info, Copy,
} from 'lucide-react';
import { usePipelineStore } from '../store/pipelineStore';

const TYPE_COLOR = {
  kpi:          'bg-amber-500/10  border-amber-500/30  text-amber-400',
  trend:        'bg-cyan-500/10   border-cyan-500/30   text-cyan-400',
  top_n:        'bg-purple-500/10 border-purple-500/30 text-purple-400',
  distribution: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  comparison:   'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
  detail:       'bg-slate-500/10  border-slate-500/30  text-slate-400',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function copySQL(sql) {
  navigator.clipboard.writeText(sql).catch(() => {});
}

function exportCSV(result) {
  const header = result.columns.join(',');
  const rows   = result.rows.map(r => r.map(v => `"${v ?? ''}"`).join(','));
  const blob   = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href       = url;
  a.download   = `${result.title || 'query'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Result Table ─────────────────────────────────────────────────────────────

function ResultTable({ result }) {
  if (result.error) {
    return (
      <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-4">
        <div className="flex items-start gap-2 mb-2">
          <AlertCircle size={13} className="text-rose-400 mt-0.5 shrink-0" />
          <span className="text-[11px] font-black text-rose-300">Erreur d'exécution</span>
        </div>
        <pre className="text-[10px] text-rose-400/80 font-mono leading-relaxed whitespace-pre-wrap break-words">
          {result.error}
        </pre>
        <p className="text-[9px] text-slate-600 mt-2">
          Vérifiez que le Data Warehouse est accessible et que les tables existent.
        </p>
      </div>
    );
  }
  if (!result.rows || result.rows.length === 0) {
    return (
      <div className="mt-3 text-[11px] text-slate-500 italic p-4 text-center bg-white/[0.02] rounded-xl border border-white/5">
        Aucun résultat retourné — la requête a réussi mais la table est vide.
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 rounded-xl border border-white/[0.06] overflow-hidden"
    >
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
          onClick={() => exportCSV(result)}
          className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 hover:text-white px-2 py-1 rounded-lg hover:bg-white/5 transition-all uppercase tracking-wider"
        >
          <Download size={10} /> CSV
        </button>
      </div>
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
                    {val === null || val === undefined
                      ? <span className="text-slate-700 italic">null</span>
                      : String(val)}
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

// ─── Query Cell ───────────────────────────────────────────────────────────────

function QueryCell({ query, result, index, onRun, isRunning }) {
  const [showSQL, setShowSQL]       = useState(false);
  const [showResult, setShowResult] = useState(!!result);
  const [copied, setCopied]         = useState(false);
  const typeClass = TYPE_COLOR[query.type] || TYPE_COLOR.detail;

  const handlePlay = async () => {
    setShowResult(true);
    await onRun(query, index);
  };

  const handleCopy = (e) => {
    e.stopPropagation();
    copySQL(query.sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
        <div className="shrink-0 w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <span className="text-[10px] font-black text-indigo-400">{index + 1}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[13px] font-black text-white">{query.title}</span>
            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${typeClass}`}>
              {query.type}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">{query.description}</p>
        </div>
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
                : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-400/60'
            }`}
          >
            {isRunning
              ? <><Loader2 size={12} className="animate-spin"/> En cours</>
              : <><Play size={12} fill="currentColor"/> Exécuter</>
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
            <div className="relative">
              <pre className="px-5 pb-4 pt-3 text-[11px] font-mono text-indigo-300 bg-black/30 border-t border-white/[0.04] leading-relaxed overflow-x-auto custom-scrollbar">
                {query.sql}
              </pre>
              <button
                onClick={handleCopy}
                className="absolute top-2 right-3 flex items-center gap-1 text-[8px] font-black text-slate-600 hover:text-slate-300 px-2 py-1 rounded hover:bg-white/5 transition-all uppercase"
              >
                {copied ? <CheckCircle2 size={9} className="text-emerald-400" /> : <Copy size={9} />}
                {copied ? 'Copié' : 'Copier'}
              </button>
            </div>
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

// ─── Connection Status Banner ─────────────────────────────────────────────────

function ConnectionBanner({ sessionId }) {
  const [status, setStatus] = useState(null); // null | 'ok' | 'error'
  const [checking, setChecking] = useState(false);

  const check = async () => {
    if (!sessionId) return;
    setChecking(true);
    try {
      const res = await fetch('/api/execute-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ sql: 'SELECT 1 AS ping', session_id: sessionId }),
      });
      const data = await res.json();
      setStatus(data.error ? 'error' : 'ok');
    } catch {
      setStatus('error');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => { check(); }, [sessionId]);

  if (!status) return null;

  return (
    <div className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[10px] font-bold mx-5 mt-3 ${
      status === 'ok'
        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
        : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
    }`}>
      {status === 'ok'
        ? <><CheckCircle2 size={11} /> DW connecté — requêtes disponibles</>
        : <><AlertCircle size={11} /> DW non accessible — vérifiez la config de connexion
          <button onClick={check} disabled={checking} className="ml-auto flex items-center gap-1 text-[9px] hover:opacity-80">
            <RefreshCw size={9} className={checking ? 'animate-spin' : ''} /> Réessayer
          </button>
        </>
      }
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function QueryRunner() {
  const { generatedQueries, queryResults, sessionId } = usePipelineStore();
  const [liveResults, setLiveResults] = useState({});
  const [running, setRunning]         = useState({});

  const queries   = generatedQueries || [];
  const preloaded = queryResults     || [];

  const getResult = (index) => liveResults[index] ?? preloaded[index] ?? null;

  const handleRun = async (query, index) => {
    setRunning(r => ({ ...r, [index]: true }));
    try {
      const res = await fetch('/api/execute-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ sql: query.sql, session_id: sessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLiveResults(r => ({ ...r, [index]: { ...query, columns: [], rows: [], error: data.detail || `HTTP ${res.status}` } }));
      } else {
        setLiveResults(r => ({
          ...r,
          [index]: {
            ...query,
            columns: data.columns || [],
            rows:    data.rows    || [],
            error:   data.error   || null,
          }
        }));
      }
    } catch (e) {
      setLiveResults(r => ({ ...r, [index]: { ...query, columns: [], rows: [], error: String(e) } }));
    } finally {
      setRunning(r => ({ ...r, [index]: false }));
    }
  };

  const runAll = async () => {
    for (let i = 0; i < queries.length; i++) {
      await handleRun(queries[i], i);
    }
  };

  if (queries.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 bg-[#050508]">
        <div className="flex flex-col items-center gap-3 opacity-40">
          <BarChart3 size={32} className="text-slate-600" />
          <p className="text-[12px] font-black text-slate-500 uppercase tracking-widest">Aucune requête disponible</p>
          <p className="text-[10px] text-slate-600 mt-1">Générées automatiquement après un pipeline complet</p>
        </div>
        <div className="flex items-start gap-3 p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.05] max-w-sm">
          <Info size={14} className="text-indigo-400 mt-0.5 shrink-0" />
          <div className="text-[10px] text-indigo-300/70 leading-relaxed">
            Le <strong>query_generator</strong> s'exécute après l'étape ETL Loader. Assurez-vous que le pipeline complet s'est terminé avec succès.
          </div>
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
            <h2 className="text-[13px] font-black text-white">Exécuteur de Requêtes</h2>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
              {queries.length} requête{queries.length > 1 ? 's' : ''} · OLAP · SQL Server
            </p>
          </div>
        </div>
        <button
          onClick={runAll}
          className="flex items-center gap-2 text-[10px] font-black px-4 py-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-all uppercase tracking-wider"
        >
          <Play size={11} fill="currentColor" /> Tout Exécuter
        </button>
      </div>

      {/* DW connection status */}
      <ConnectionBanner sessionId={sessionId} />

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
