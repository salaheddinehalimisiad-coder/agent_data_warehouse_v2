// src/components/StarSchemaViewer.jsx — Star Schema Architect v4.0 Interactive
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star, Link, Key, ChevronDown, ChevronRight,
  Database, Layers, Code2, Copy, Check,
  GitMerge, Info, Hash, ArrowRight
} from 'lucide-react';
import { usePipelineStore } from '../store/pipelineStore';

const ROLE_STYLE = {
  pk:        { bg: 'bg-yellow-400/15', border: 'border-yellow-400/20', text: 'text-yellow-400', label: 'PK' },
  fk:        { bg: 'bg-cyan-400/15',   border: 'border-cyan-400/20',   text: 'text-cyan-400',   label: 'FK' },
  metric:    { bg: 'bg-emerald-400/15',border: 'border-emerald-400/20',text: 'text-emerald-400',label: 'MET' },
  attribute: { bg: 'bg-white/[0.04]',  border: 'border-white/[0.06]',  text: 'text-slate-500',  label: 'ATT' },
};

function TypeBadge({ type }) {
  const t = (type || '').toLowerCase();
  const color = t.includes('bigint') || t.includes('int') ? 'text-cyan-400'
              : t.includes('decimal') || t.includes('float') ? 'text-emerald-400'
              : t.includes('date') ? 'text-purple-400'
              : t.includes('char') || t.includes('text') ? 'text-amber-400'
              : t.includes('tinyint') ? 'text-indigo-400'
              : 'text-slate-500';
  return <span className={`text-[9px] font-mono font-bold tracking-tighter ${color}`}>{t.toUpperCase()}</span>;
}

function ColumnRow({ col, onFkClick, highlightedDim }) {
  const rs = ROLE_STYLE[col.role] || ROLE_STYLE.attribute;
  const isFk = col.role === 'fk';
  const ref = col.references || '';

  return (
    <motion.div
      layout
      className={`flex items-center justify-between px-3 py-2 rounded-xl border transition-all ${
        isFk && highlightedDim === ref
          ? 'border-cyan-500/40 bg-cyan-500/10'
          : `${rs.border} hover:bg-white/[0.03]`
      } ${rs.bg} ${isFk ? 'cursor-pointer' : ''}`}
      onClick={isFk && onFkClick ? () => onFkClick(ref) : undefined}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${rs.bg} ${rs.border} ${rs.text} shrink-0`}>
          {rs.label}
        </span>
        <span className="text-[11px] font-mono font-semibold text-slate-200 truncate">{col.name}</span>
        {isFk && ref && (
          <span className="text-[9px] text-cyan-500 flex items-center gap-1 shrink-0">
            <ArrowRight size={8} />{ref}
          </span>
        )}
      </div>
      <TypeBadge type={col.type} />
    </motion.div>
  );
}

function TableCard({ name, table, isFactTable, isSelected, onSelect, highlightedBy, onFkClick, highlightedDim }) {
  const columns = table?.columns || [];
  const scols = { pk: 0, fk: 0, metric: 0, attribute: 0 };
  columns.forEach(c => { if (scols[c.role] !== undefined) scols[c.role]++; });

  const hasSCD = columns.some(c => c.name === 'is_current' || c.name === 'valid_from');

  return (
    <motion.div
      layout
      className={`rounded-2xl border transition-all overflow-hidden ${
        isSelected ? 'border-indigo-500/40' :
        highlightedBy ? 'border-cyan-500/30' :
        'border-white/[0.05]'
      }`}
      style={{
        background: isSelected ? 'rgba(99,102,241,0.06)' :
                    highlightedBy ? 'rgba(6,182,212,0.04)' :
                    'rgba(255,255,255,0.02)'
      }}
    >
      {/* Header */}
      <button
        onClick={() => onSelect(name)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          isFactTable ? 'bg-indigo-600 border border-indigo-400 text-white shadow-lg shadow-indigo-500/20'
                      : 'bg-white/5 border border-white/10 text-slate-500'
        }`}>
          {isFactTable ? <Star size={15} fill="white" /> : <Database size={14} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-[12px] font-black text-white uppercase tracking-tight truncate">{name}</h4>
            {hasSCD && (
              <span className="text-[8px] font-black text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded-full">
                SCD2
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[9px] text-slate-600">{columns.length} colonnes</span>
            {scols.fk > 0 && <span className="text-[9px] text-cyan-500">{scols.fk} FK</span>}
            {scols.metric > 0 && <span className="text-[9px] text-emerald-500">{scols.metric} métriques</span>}
          </div>
        </div>
        <ChevronRight
          size={13}
          className={`text-slate-600 transition-transform shrink-0 ${isSelected ? 'rotate-90' : ''}`}
        />
      </button>

      {/* Expanded columns */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-white/[0.04] space-y-1.5">
              {columns.map((col, i) => (
                <ColumnRow
                  key={i}
                  col={col}
                  onFkClick={onFkClick}
                  highlightedDim={highlightedDim}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function StarSchemaViewer() {
  const { logicalModel, sqlDDL, userPrefix } = usePipelineStore();
  const [selectedTable, setSelectedTable]   = useState(null);
  const [highlightedDim, setHighlightedDim] = useState(null);
  const [showDDL, setShowDDL]               = useState(false);
  const [copied, setCopied]                 = useState(false);

  const factTable = logicalModel?.fact_table;
  const dimTables = logicalModel?.dimension_tables || [];

  const dimMap = useMemo(() => {
    const m = {};
    dimTables.forEach(d => { m[d.name] = d; });
    return m;
  }, [dimTables]);

  // Quelles dims sont référencées par la fact sélectionnée ?
  const referencedDims = useMemo(() => {
    if (!factTable || selectedTable !== factTable.name) return new Set();
    return new Set(
      factTable.columns
        .filter(c => c.role === 'fk' && c.references)
        .map(c => c.references)
    );
  }, [selectedTable, factTable]);

  const handleFkClick = (dimName) => {
    setHighlightedDim(prev => prev === dimName ? null : dimName);
    setSelectedTable(dimName);
  };

  const handleCopyDDL = () => {
    if (sqlDDL) {
      navigator.clipboard.writeText(sqlDDL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const totalCols = (factTable?.columns?.length || 0) +
    dimTables.reduce((s, d) => s + (d.columns?.length || 0), 0);
  const totalTables = dimTables.length + (factTable ? 1 : 0);

  if (!logicalModel || !factTable) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 opacity-40">
        <Star size={32} className="text-slate-600" />
        <div className="text-center">
          <p className="text-[12px] font-black text-slate-500 uppercase tracking-widest">Star Schema non généré</p>
          <p className="text-[10px] text-slate-600 mt-1">Lancez un pipeline pour générer le modèle OLAP</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Star size={15} className="text-indigo-400" fill="currentColor" />
          </div>
          <div>
            <h2 className="text-[13px] font-black text-white">Star Schema — {userPrefix || 'dw'}</h2>
            <p className="text-[10px] text-slate-500">
              {totalTables} tables · {totalCols} colonnes · Cliquez une FK pour naviguer
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sqlDDL && (
            <button
              onClick={handleCopyDDL}
              className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-xl border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.05] transition-all"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              {copied ? 'Copié !' : 'Copier DDL'}
            </button>
          )}
          <button
            onClick={() => setShowDDL(v => !v)}
            className={`flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-xl border transition-all ${
              showDDL
                ? 'border-indigo-500/30 text-indigo-400 bg-indigo-500/10'
                : 'border-white/[0.08] text-slate-400 hover:text-white'
            }`}
          >
            <Code2 size={12} /> DDL SQL
          </button>
        </div>
      </div>

      {/* DDL Panel */}
      <AnimatePresence>
        {showDDL && sqlDDL && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 200 }} exit={{ height: 0 }}
            className="overflow-hidden border-b shrink-0"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <pre className="h-full overflow-auto p-4 text-[10px] font-mono text-slate-300 leading-relaxed custom-scrollbar"
                 style={{ background: 'rgba(0,0,0,0.3)' }}>
              {sqlDDL}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Schema */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-3">
        {/* Fact table first */}
        <TableCard
          name={factTable.name}
          table={factTable}
          isFactTable={true}
          isSelected={selectedTable === factTable.name}
          onSelect={setSelectedTable}
          onFkClick={handleFkClick}
          highlightedDim={highlightedDim}
        />

        {/* Separator */}
        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-white/[0.04]" />
          <span className="text-[9px] font-black text-slate-700 uppercase tracking-wider">Dimensions</span>
          <div className="flex-1 h-px bg-white/[0.04]" />
        </div>

        {/* Dimension tables */}
        {dimTables.map(dim => (
          <TableCard
            key={dim.name}
            name={dim.name}
            table={dim}
            isFactTable={false}
            isSelected={selectedTable === dim.name}
            onSelect={setSelectedTable}
            highlightedBy={referencedDims.has(dim.name) || highlightedDim === dim.name}
            onFkClick={handleFkClick}
            highlightedDim={highlightedDim}
          />
        ))}
      </div>
    </div>
  );
}
