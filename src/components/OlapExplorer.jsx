// src/components/OlapExplorer.jsx — Multidimensional OLAP Cube Explorer
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers, Play, X, Plus, ChevronDown, ChevronUp, Download,
  AlertCircle, CheckCircle2, Loader2, Filter, Hash, SlidersHorizontal,
  Table2, RefreshCw, Code2
} from 'lucide-react';
import { usePipelineStore } from '../store/pipelineStore';

const AGG_OPTIONS = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'COUNT(*)'];
const OP_OPTIONS  = ['=', '!=', '>', '>=', '<', '<=', 'IN', 'IS NULL', 'IS NOT NULL'];

// ─── Pill ────────────────────────────────────────────────────────────────────

function Pill({ label, color = 'indigo', onRemove, badge }) {
  const colors = {
    indigo: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300',
    amber:  'bg-amber-500/15  border-amber-500/30  text-amber-300',
    cyan:   'bg-cyan-500/15   border-cyan-500/30   text-cyan-300',
    rose:   'bg-rose-500/15   border-rose-500/30   text-rose-300',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold ${colors[color]}`}>
      {badge && <span className="text-[8px] opacity-60">{badge}</span>}
      {label}
      {onRemove && (
        <button onClick={onRemove} className="opacity-50 hover:opacity-100 transition-opacity">
          <X size={9} />
        </button>
      )}
    </span>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionLabel({ icon: Icon, label, count, color = 'text-slate-400' }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon size={12} className={color} />
      <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${color}`}>{label}</span>
      {count !== undefined && (
        <span className="ml-auto text-[9px] font-bold text-slate-600">{count}</span>
      )}
    </div>
  );
}

// ─── Dimension Browser (left panel) ──────────────────────────────────────────

function DimBrowser({ schema, rowDims, measures, onAddDim, onAddMeasure }) {
  const [openDim, setOpenDim]   = useState(null);
  const [openFact, setOpenFact] = useState(null);

  return (
    <div className="flex flex-col gap-3 overflow-y-auto custom-scrollbar h-full pr-1">
      {/* Dimensions */}
      <div>
        <SectionLabel icon={Table2} label="Dimensions" color="text-indigo-400" />
        {schema.dimensions.map(dim => (
          <div key={dim.name} className="mb-1.5">
            <button
              onClick={() => setOpenDim(openDim === dim.name ? null : dim.name)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-indigo-500/5 border border-indigo-500/15 hover:border-indigo-400/30 transition-all"
            >
              <span className="text-[10px] font-black text-indigo-300 uppercase truncate">{dim.name.replace('dim_', '')}</span>
              {openDim === dim.name ? <ChevronUp size={10} className="text-slate-500"/> : <ChevronDown size={10} className="text-slate-500"/>}
            </button>
            <AnimatePresence>
              {openDim === dim.name && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pl-2 pt-1 space-y-0.5">
                    {dim.columns.map(col => {
                      const already = rowDims.some(d => d.dim === dim.name && d.col === col.name);
                      return (
                        <button
                          key={col.name}
                          onClick={() => !already && onAddDim({ dim: dim.name, col: col.name })}
                          disabled={already}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left transition-all text-[10px] ${
                            already
                              ? 'opacity-40 cursor-default bg-indigo-500/5'
                              : 'hover:bg-indigo-500/10 text-slate-400 hover:text-indigo-300'
                          }`}
                        >
                          <Hash size={8} className="opacity-40 shrink-0" />
                          <span className="font-mono truncate">{col.name}</span>
                          {col.type && <span className="ml-auto text-[8px] text-slate-600 shrink-0">{col.type}</span>}
                          {already && <CheckCircle2 size={9} className="ml-auto text-indigo-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* Facts / Measures */}
      <div>
        <SectionLabel icon={Hash} label="Mesures" color="text-amber-400" />
        {schema.facts.map(fact => (
          <div key={fact.name} className="mb-1.5">
            <button
              onClick={() => setOpenFact(openFact === fact.name ? null : fact.name)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-amber-500/5 border border-amber-500/15 hover:border-amber-400/30 transition-all"
            >
              <span className="text-[10px] font-black text-amber-300 uppercase truncate">{fact.name.replace('fact_', '')}</span>
              {openFact === fact.name ? <ChevronUp size={10} className="text-slate-500"/> : <ChevronDown size={10} className="text-slate-500"/>}
            </button>
            <AnimatePresence>
              {openFact === fact.name && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pl-2 pt-1 space-y-0.5">
                    {fact.metrics.map(m => {
                      const isCount = m.name === '*';
                      return (
                        <button
                          key={m.name}
                          onClick={() => onAddMeasure({
                            fact: fact.name,
                            col:  m.name,
                            agg:  isCount ? 'COUNT' : 'SUM',
                            alias: isCount ? 'nb_lignes' : `sum_${m.name}`,
                          })}
                          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left hover:bg-amber-500/10 text-slate-400 hover:text-amber-300 transition-all text-[10px]"
                        >
                          <span className="text-amber-500 font-black text-[8px]">Σ</span>
                          <span className="font-mono truncate">{m.label || m.name}</span>
                          {m.type && <span className="ml-auto text-[8px] text-slate-600 shrink-0">{m.type}</span>}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Measure Editor ───────────────────────────────────────────────────────────

function MeasureChip({ m, index, onChange, onRemove }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-amber-500/8 border border-amber-500/20">
      <select
        value={m.agg}
        onChange={e => onChange(index, { ...m, agg: e.target.value })}
        className="text-[9px] font-black uppercase bg-transparent text-amber-300 border-none outline-none cursor-pointer"
      >
        {AGG_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
      </select>
      <span className="text-[9px] text-amber-400/60">(</span>
      <span className="text-[10px] font-mono text-amber-300 truncate max-w-[80px]">{m.col === '*' ? '*' : m.col}</span>
      <span className="text-[9px] text-amber-400/60">)</span>
      <input
        value={m.alias}
        onChange={e => onChange(index, { ...m, alias: e.target.value })}
        className="text-[9px] font-mono bg-transparent text-slate-400 border-none outline-none w-20 border-b border-dashed border-white/10 focus:border-amber-400/40"
        placeholder="alias"
      />
      <button onClick={() => onRemove(index)} className="opacity-40 hover:opacity-100 transition-opacity ml-1">
        <X size={9} className="text-rose-400" />
      </button>
    </div>
  );
}

// ─── Filter Row ────────────────────────────────────────────────────────────────

function FilterRow({ f, index, schema, onChange, onRemove }) {
  const needsVal = !['IS NULL', 'IS NOT NULL'].includes(f.op);
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06]">
      {/* Dim selector */}
      <select
        value={f.dim}
        onChange={e => onChange(index, { ...f, dim: e.target.value, col: '' })}
        className="text-[9px] font-bold bg-transparent text-slate-300 border-none outline-none cursor-pointer max-w-[100px]"
      >
        <option value="__fact__">fact.*</option>
        {schema.dimensions.map(d => (
          <option key={d.name} value={d.name}>{d.name.replace('dim_', '')}</option>
        ))}
      </select>
      <span className="text-slate-700">·</span>
      {/* Column selector */}
      <select
        value={f.col}
        onChange={e => onChange(index, { ...f, col: e.target.value })}
        className="text-[9px] font-mono bg-transparent text-slate-400 border-none outline-none cursor-pointer max-w-[110px]"
      >
        <option value="">— colonne —</option>
        {(f.dim === '__fact__'
          ? schema.facts.flatMap(ft => ft.metrics.filter(m => m.name !== '*').map(m => m.name))
          : (schema.dimensions.find(d => d.name === f.dim)?.columns || []).map(c => c.name)
        ).map(col => <option key={col} value={col}>{col}</option>)}
      </select>
      {/* Operator */}
      <select
        value={f.op}
        onChange={e => onChange(index, { ...f, op: e.target.value })}
        className="text-[9px] font-bold bg-transparent text-indigo-300 border-none outline-none cursor-pointer"
      >
        {OP_OPTIONS.map(op => <option key={op} value={op}>{op}</option>)}
      </select>
      {/* Value */}
      {needsVal && (
        <input
          value={f.val}
          onChange={e => onChange(index, { ...f, val: e.target.value })}
          placeholder="valeur"
          className="flex-1 text-[9px] font-mono bg-transparent text-slate-300 border-b border-dashed border-white/10 focus:border-indigo-400/40 outline-none min-w-0"
        />
      )}
      <button onClick={() => onRemove(index)} className="opacity-40 hover:opacity-100 ml-1 shrink-0">
        <X size={9} className="text-rose-400" />
      </button>
    </div>
  );
}

// ─── Result Table ──────────────────────────────────────────────────────────────

function ResultsTable({ result }) {
  const [showSQL, setShowSQL] = useState(false);

  if (!result) return null;
  if (result.error) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
        <AlertCircle size={13} className="text-rose-400 mt-0.5 shrink-0" />
        <span className="text-[11px] text-rose-300 font-mono">{result.error}</span>
      </div>
    );
  }

  const { columns = [], rows = [], total = 0, sql = '' } = result;

  const exportCSV = () => {
    const header = columns.join(',');
    const body   = rows.map(r => r.map(v => `"${v ?? ''}"`).join(','));
    const blob   = new Blob([[header, ...body].join('\n')], { type: 'text/csv' });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a');
    a.href       = url;
    a.download   = 'olap_result.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">
      {/* Stats row */}
      <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06]">
        <div className="flex items-center gap-3">
          <CheckCircle2 size={12} className="text-emerald-400" />
          <span className="text-[10px] font-black text-emerald-400 uppercase">{total} ligne{total > 1 ? 's' : ''}</span>
          <span className="text-slate-700">·</span>
          <span className="text-[10px] font-black text-slate-500 uppercase">{columns.length} colonnes</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSQL(s => !s)}
            className="flex items-center gap-1 text-[9px] font-black text-slate-500 hover:text-slate-300 px-2 py-1 rounded-lg hover:bg-white/5 transition-all uppercase"
          >
            <Code2 size={9}/> SQL
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 hover:text-white px-2 py-1 rounded-lg hover:bg-white/5 transition-all uppercase"
          >
            <Download size={9}/> CSV
          </button>
        </div>
      </div>

      {/* SQL viewer */}
      <AnimatePresence>
        {showSQL && sql && (
          <motion.pre
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden text-[10px] font-mono text-indigo-300 bg-black/40 border border-white/[0.05] rounded-xl px-4 py-3 overflow-x-auto custom-scrollbar"
          >
            {sql}
          </motion.pre>
        )}
      </AnimatePresence>

      {/* Table */}
      {rows.length === 0 ? (
        <p className="text-[11px] text-slate-500 italic text-center py-4">Aucun résultat.</p>
      ) : (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar max-h-72">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead className="sticky top-0">
                <tr className="bg-[#0d0d14]">
                  {columns.map(col => (
                    <th key={col} className="px-3 py-2 font-black text-slate-400 border-r border-white/5 last:border-0 uppercase tracking-tight whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className={`border-b border-white/[0.03] ${i % 2 === 0 ? 'bg-white/[0.01]' : ''} hover:bg-indigo-500/[0.04]`}>
                    {row.map((val, j) => (
                      <td key={j} className="px-3 py-1.5 text-slate-300 whitespace-nowrap border-r border-white/[0.03] last:border-0 font-mono">
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
        </div>
      )}
    </motion.div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function OlapExplorer() {
  const { sessionId, pipelineStatus } = usePipelineStore();

  const [schema,   setSchema]   = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [running,  setRunning]  = useState(false);
  const [error,    setError]    = useState(null);
  const [result,   setResult]   = useState(null);

  // Cube state
  const [rowDims,   setRowDims]   = useState([]);   // [{dim, col, alias}]
  const [measures,  setMeasures]  = useState([]);   // [{fact, col, agg, alias}]
  const [filters,   setFilters]   = useState([]);   // [{dim, col, op, val}]
  const [topN,      setTopN]      = useState(0);

  // Load schema on mount / when session changes
  const loadSchema = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/olap/schema?session_id=${sessionId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Erreur schema');
      }
      const data = await res.json();
      setSchema(data);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { loadSchema(); }, [loadSchema]);

  // Re-fetch schema when pipeline completes (catches the case where OLAP tab was open during run)
  useEffect(() => {
    if (pipelineStatus === 'complete' && sessionId && !schema) {
      loadSchema();
    }
  }, [pipelineStatus, sessionId, schema, loadSchema]);

  const addDim = (d) => {
    setRowDims(prev => [...prev, { ...d, alias: `${d.dim.replace('dim_', '')}__${d.col}` }]);
  };

  const removeDim = (i) => setRowDims(prev => prev.filter((_, idx) => idx !== i));

  const addMeasure = (m) => setMeasures(prev => [...prev, m]);
  const removeMeasure = (i) => setMeasures(prev => prev.filter((_, idx) => idx !== i));
  const updateMeasure = (i, m) => setMeasures(prev => prev.map((x, idx) => idx === i ? m : x));

  const addFilter = () => setFilters(prev => [
    ...prev,
    { dim: schema?.dimensions[0]?.name || '__fact__', col: '', op: '=', val: '' }
  ]);
  const removeFilter = (i) => setFilters(prev => prev.filter((_, idx) => idx !== i));
  const updateFilter = (i, f) => setFilters(prev => prev.map((x, idx) => idx === i ? f : x));

  const reset = () => { setRowDims([]); setMeasures([]); setFilters([]); setTopN(0); setResult(null); };

  const runQuery = async () => {
    if (!measures.length) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch('/api/olap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          session_id: sessionId,
          row_dims:   rowDims,
          measures,
          // Strip incomplete filters before sending — prevents empty-alias SQL errors
          filters: filters.filter(f =>
            f.col && f.col !== '-' && f.col !== '' &&
            (f.op === 'IS NULL' || f.op === 'IS NOT NULL' || (f.val !== '' && f.val != null))
          ),
          top_n:      topN,
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setResult({ error: String(e) });
    } finally {
      setRunning(false);
    }
  };

  // ── Render: no session ──
  if (!sessionId) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 opacity-40 bg-[#050508]">
        <Layers size={32} className="text-slate-600" />
        <p className="text-[12px] font-black text-slate-500 uppercase tracking-widest">Session requise</p>
        <p className="text-[10px] text-slate-600">Lancez d'abord un pipeline complet</p>
      </div>
    );
  }

  // ── Render: loading ──
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#050508]">
        <Loader2 size={22} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  // ── Render: schema error ──
  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 bg-[#050508]">
        <AlertCircle size={28} className="text-rose-400" />
        <p className="text-[11px] text-rose-300 font-mono max-w-sm text-center">{error}</p>
        <button onClick={loadSchema} className="flex items-center gap-2 text-[10px] font-black uppercase text-indigo-400 hover:text-white px-4 py-2 rounded-xl border border-indigo-500/30 hover:bg-indigo-500/10 transition-all">
          <RefreshCw size={11}/> Réessayer
        </button>
      </div>
    );
  }

  // ── Render: no schema ──
  if (!schema) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 opacity-40 bg-[#050508]">
        <Layers size={32} className="text-slate-600" />
        <p className="text-[12px] font-black text-slate-500 uppercase tracking-widest">OLAP non disponible</p>
        <p className="text-[10px] text-slate-600">Le pipeline doit être complété pour accéder au cube</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#050508] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
            <Layers size={15} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="text-[13px] font-black text-white uppercase tracking-tight">Explorateur Cube OLAP</h2>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em]">
              {schema.dimensions.length} dim · {schema.facts.length} fact · {schema.prefix}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={reset} className="flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-500 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-all border border-white/5">
            <RefreshCw size={10}/> Réinitialiser
          </button>
          <button
            onClick={runQuery}
            disabled={running || measures.length === 0}
            className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-wider px-5 py-2 rounded-xl border transition-all ${
              running || measures.length === 0
                ? 'border-slate-700 bg-slate-800/60 text-slate-500 cursor-not-allowed'
                : 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 hover:border-indigo-400/60 hover:shadow-lg hover:shadow-indigo-500/10'
            }`}
          >
            {running ? <><Loader2 size={12} className="animate-spin"/> Calcul...</> : <><Play size={12} fill="currentColor"/> Exécuter</>}
          </button>
        </div>
      </div>

      {/* Body: 3 columns */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* LEFT: Dimension/Measure Browser */}
        <div className="w-56 shrink-0 border-r border-white/5 p-4 overflow-hidden flex flex-col">
          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-600 mb-3">Champs disponibles</p>
          <DimBrowser
            schema={schema}
            rowDims={rowDims}
            measures={measures}
            onAddDim={addDim}
            onAddMeasure={addMeasure}
          />
        </div>

        {/* CENTER: Query Builder + Results */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">

            {/* Row Axes */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4">
              <SectionLabel icon={Table2} label="Axes (lignes)" count={rowDims.length} color="text-indigo-400" />
              <div className="flex flex-wrap gap-2 min-h-[36px]">
                {rowDims.length === 0 && (
                  <span className="text-[10px] text-slate-700 italic">Cliquez sur une colonne dimension à gauche →</span>
                )}
                {rowDims.map((d, i) => (
                  <Pill
                    key={i}
                    color="indigo"
                    badge={d.dim.replace('dim_', '')}
                    label={d.col}
                    onRemove={() => removeDim(i)}
                  />
                ))}
              </div>
            </div>

            {/* Measures */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4">
              <SectionLabel icon={Hash} label="Mesures" count={measures.length} color="text-amber-400" />
              <div className="flex flex-wrap gap-2 min-h-[36px]">
                {measures.length === 0 && (
                  <span className="text-[10px] text-slate-700 italic">Cliquez sur une mesure à gauche → (au moins une requise)</span>
                )}
                {measures.map((m, i) => (
                  <MeasureChip
                    key={i}
                    m={m}
                    index={i}
                    onChange={updateMeasure}
                    onRemove={removeMeasure}
                  />
                ))}
              </div>
            </div>

            {/* Filters */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4">
              <div className="flex items-center justify-between mb-2">
                <SectionLabel icon={Filter} label="Filtres" count={filters.length} color="text-cyan-400" />
                <button
                  onClick={addFilter}
                  className="flex items-center gap-1 text-[9px] font-black uppercase text-slate-500 hover:text-cyan-300 px-2 py-1 rounded-lg hover:bg-white/5 transition-all"
                >
                  <Plus size={9}/> Ajouter
                </button>
              </div>
              <div className="space-y-1.5">
                {filters.length === 0 && (
                  <span className="text-[10px] text-slate-700 italic">Aucun filtre — tous les enregistrements inclus</span>
                )}
                {filters.map((f, i) => (
                  <FilterRow
                    key={i}
                    f={f}
                    index={i}
                    schema={schema}
                    onChange={updateFilter}
                    onRemove={removeFilter}
                  />
                ))}
              </div>
            </div>

            {/* Options */}
            <div className="flex items-center gap-4 px-4 py-2 rounded-xl bg-white/[0.01] border border-white/[0.04]">
              <SlidersHorizontal size={11} className="text-slate-600" />
              <label className="text-[9px] font-black uppercase text-slate-500">Top N</label>
              <input
                type="number"
                min={0}
                value={topN}
                onChange={e => setTopN(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-16 text-[10px] font-mono bg-transparent text-slate-300 border-b border-dashed border-white/10 focus:border-indigo-400/40 outline-none text-center"
              />
              <span className="text-[9px] text-slate-600">(0 = pas de limite)</span>
            </div>

            {/* Results */}
            {result && <ResultsTable result={result} />}
          </div>
        </div>
      </div>
    </div>
  );
}
