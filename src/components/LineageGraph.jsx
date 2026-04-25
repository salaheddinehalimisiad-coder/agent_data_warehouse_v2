// src/components/LineageGraph.jsx — Data Lineage v4.0 (card layout, no SVG)
import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitMerge, Database, Star, Table2, X, ArrowRight, Hash, ChevronDown, ChevronUp } from 'lucide-react';
import { usePipelineStore } from '../store/pipelineStore';

// ─── Extract table-level graph from lineage data ─────────────────────────────

function buildGraph(lineage) {
  const sources  = {};   // { tableName: { cols: Set } }
  const dims     = {};   // { tableName: { cols: Set, sources: Set } }
  const facts    = {};   // { tableName: { cols: Set, sources: Set } }

  Object.entries(lineage).forEach(([dwTable, tableData]) => {
    const nodes = tableData.nodes || [];
    const type  = tableData.type || 'dimension';

    const targetCols = nodes.filter(n => n.kind === 'target').map(n => n.label);
    const sourceCols = nodes.filter(n => n.kind === 'source');

    const bucket = (type === 'fact' || dwTable.includes('fact_')) ? facts : dims;
    if (!bucket[dwTable]) bucket[dwTable] = { cols: new Set(), sources: new Set() };
    targetCols.forEach(c => bucket[dwTable].cols.add(c));

    sourceCols.forEach(n => {
      const tbl = n.table || 'source';
      if (!sources[tbl]) sources[tbl] = { cols: new Set() };
      sources[tbl].cols.add(n.label);
      bucket[dwTable].sources.add(tbl);
    });
  });

  return { sources, dims, facts };
}

// ─── Column List ─────────────────────────────────────────────────────────────

function ColList({ cols, max = 6 }) {
  const [expanded, setExpanded] = useState(false);
  const arr     = [...cols];
  const visible = expanded ? arr : arr.slice(0, max);
  const extra   = arr.length - max;

  return (
    <div className="space-y-0.5 mt-2">
      {visible.map(col => (
        <div key={col} className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.03]">
          <Hash size={8} className="text-slate-600 shrink-0" />
          <span className="text-[9px] font-mono text-slate-400 truncate">{col}</span>
        </div>
      ))}
      {extra > 0 && !expanded && (
        <button
          onClick={e => { e.stopPropagation(); setExpanded(true); }}
          className="flex items-center gap-1 text-[8px] font-bold text-slate-600 hover:text-slate-400 px-2 py-0.5 transition-colors"
        >
          <ChevronDown size={8}/> +{extra} colonnes
        </button>
      )}
      {expanded && arr.length > max && (
        <button
          onClick={e => { e.stopPropagation(); setExpanded(false); }}
          className="flex items-center gap-1 text-[8px] font-bold text-slate-600 hover:text-slate-400 px-2 py-0.5 transition-colors"
        >
          <ChevronUp size={8}/> Réduire
        </button>
      )}
    </div>
  );
}

// ─── Source Card ─────────────────────────────────────────────────────────────

function SourceCard({ name, info, selected, onClick }) {
  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      onClick={() => onClick(selected ? null : { kind: 'source', name, ...info })}
      className={`cursor-pointer rounded-2xl border p-4 transition-all ${
        selected
          ? 'border-slate-400/60 bg-slate-700/40 shadow-lg'
          : 'border-slate-700/40 bg-slate-900/50 hover:border-slate-600/50'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
          <Database size={11} className="text-slate-400" />
        </div>
        <span className="text-[11px] font-black text-white uppercase truncate">{name}</span>
        <span className="ml-auto text-[8px] font-bold text-slate-600 shrink-0 bg-slate-800 px-1.5 py-0.5 rounded-full">
          {info.cols.size} col
        </span>
      </div>
      <ColList cols={info.cols} max={5} />
    </motion.div>
  );
}

// ─── DW Card ─────────────────────────────────────────────────────────────────

function DWCard({ name, info, isFact, selected, onClick }) {
  const border  = selected ? (isFact ? 'border-amber-400/70' : 'border-indigo-400/70')
                           : (isFact ? 'border-amber-500/25 hover:border-amber-400/50' : 'border-indigo-500/25 hover:border-indigo-400/50');
  const bg      = selected ? (isFact ? 'bg-amber-500/20' : 'bg-indigo-600/30')
                           : (isFact ? 'bg-amber-500/[0.06]' : 'bg-indigo-500/[0.06]');
  const accent  = isFact ? 'text-amber-400' : 'text-indigo-400';
  const iconBg  = isFact ? 'bg-amber-500/20 border-amber-500/30' : 'bg-indigo-500/20 border-indigo-500/30';

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      onClick={() => onClick(selected ? null : { kind: 'dw', name, isFact, ...info })}
      className={`cursor-pointer rounded-2xl border p-4 transition-all ${border} ${bg}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-6 h-6 rounded-lg flex items-center justify-center border shrink-0 ${iconBg}`}>
          <Star size={11} fill="currentColor" className={accent} />
        </div>
        <span className="text-[11px] font-black text-white uppercase truncate">{name}</span>
        <span className={`ml-auto text-[8px] font-black shrink-0 ${accent}`}>
          {isFact ? '★ FACT' : '◇ DIM'}
        </span>
      </div>
      <div className="text-[8px] font-bold text-slate-600 mb-1">
        {[...info.sources].join(', ')}
      </div>
      <ColList cols={info.cols} max={5} />
    </motion.div>
  );
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function DetailDrawer({ node, onClose }) {
  if (!node) return null;
  const isFact   = node.isFact;
  const isSource = node.kind === 'source';
  const title    = isSource ? 'Source Table' : isFact ? '★ Fact Table' : '◇ Dimension';
  const accent   = isSource ? 'text-slate-300' : isFact ? 'text-amber-400' : 'text-indigo-400';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 24 }}
        className="absolute right-4 top-4 bottom-4 w-64 bg-[#0d0d14]/95 border border-white/10 rounded-2xl p-5 overflow-y-auto custom-scrollbar z-30 shadow-2xl"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${accent}`}>{title}</div>
            <h4 className="text-sm font-black text-white uppercase leading-tight">{node.name}</h4>
            {node.sources && (
              <div className="text-[8px] text-slate-600 mt-0.5">
                ← {[...node.sources].join(', ')}
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-all shrink-0">
            <X size={12} />
          </button>
        </div>
        <div className="space-y-1">
          {[...node.cols].map(col => (
            <div key={col} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.04]">
              <Table2 size={9} className="text-slate-600 shrink-0" />
              <span className="text-[10px] font-mono text-slate-300 truncate">{col}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LineageGraph() {
  const { lineage } = usePipelineStore();
  const [selected, setSelected] = useState(null);

  const { sources, dims, facts } = useMemo(() => {
    if (!lineage || typeof lineage !== 'object') return { sources: {}, dims: {}, facts: {} };
    return buildGraph(lineage);
  }, [lineage]);

  const srcList  = Object.entries(sources);
  const dimList  = Object.entries(dims);
  const factList = Object.entries(facts);
  const dwList   = [...dimList.map(([n, i]) => [n, i, false]), ...factList.map(([n, i]) => [n, i, true])];

  const isEmpty  = srcList.length === 0 && dwList.length === 0;

  if (!lineage || isEmpty) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 opacity-40 bg-[#050508]">
        <GitMerge size={32} className="text-slate-600" />
        <p className="text-[12px] font-black text-slate-500 uppercase tracking-widest">Lineage pending</p>
        <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold">
          Visible après exécution ETL complète
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#050508] overflow-hidden relative">

      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-white/5 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
          <GitMerge size={15} className="text-indigo-400" />
        </div>
        <div>
          <h2 className="text-[13px] font-black text-white uppercase tracking-tight">Data Lineage</h2>
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em]">
            {srcList.length} source{srcList.length > 1 ? 's' : ''} →
            {dimList.length} dim{dimList.length > 1 ? 's' : ''} +
            {factList.length} fact{factList.length > 1 ? 's' : ''}
          </p>
        </div>
        {/* Legend */}
        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-500"/><span className="text-[8px] font-black text-slate-500 uppercase">Source</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-500"/><span className="text-[8px] font-black text-slate-500 uppercase">Dimension</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500"/><span className="text-[8px] font-black text-slate-500 uppercase">Fact</span></div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto custom-scrollbar p-6">
        <div className="flex gap-6 items-start min-w-[580px]">

          {/* LEFT: Source Tables */}
          <div className="shrink-0 w-52">
            <div className="text-[8px] font-black text-slate-600 uppercase tracking-[0.25em] mb-3 flex items-center gap-2">
              <Database size={9}/> Sources ({srcList.length})
            </div>
            <div className="space-y-2">
              {srcList.map(([name, info]) => (
                <SourceCard
                  key={name}
                  name={name}
                  info={info}
                  selected={selected?.name === name}
                  onClick={setSelected}
                />
              ))}
            </div>
          </div>

          {/* CENTER: Arrow zone */}
          <div className="flex flex-col items-center justify-center pt-8 shrink-0 w-16 gap-2">
            <ArrowRight size={20} className="text-indigo-400/40" />
            <span className="text-[7px] font-black text-slate-700 uppercase tracking-widest">ETL</span>
            <ArrowRight size={20} className="text-indigo-400/40" />
          </div>

          {/* RIGHT: DW Tables */}
          <div className="flex-1 min-w-0">
            {dimList.length > 0 && (
              <>
                <div className="text-[8px] font-black text-indigo-500 uppercase tracking-[0.25em] mb-3 flex items-center gap-2">
                  <Star size={9}/> Dimensions ({dimList.length})
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 mb-5">
                  {dimList.map(([name, info]) => (
                    <DWCard
                      key={name}
                      name={name}
                      info={info}
                      isFact={false}
                      selected={selected?.name === name}
                      onClick={setSelected}
                    />
                  ))}
                </div>
              </>
            )}
            {factList.length > 0 && (
              <>
                <div className="text-[8px] font-black text-amber-500 uppercase tracking-[0.25em] mb-3 flex items-center gap-2">
                  <Star size={9} fill="currentColor"/> Facts ({factList.length})
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                  {factList.map(([name, info]) => (
                    <DWCard
                      key={name}
                      name={name}
                      info={info}
                      isFact={true}
                      selected={selected?.name === name}
                      onClick={setSelected}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Detail Drawer */}
      <DetailDrawer node={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
