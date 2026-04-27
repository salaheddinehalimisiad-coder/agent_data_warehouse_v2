// src/components/LineageGraph.jsx — Data Lineage v5.0 (attribute-level tracking)
import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitMerge, Database, Star, Table2, X, ArrowRight, Hash,
  ChevronDown, ChevronUp, Search, MapPin, Zap,
} from 'lucide-react';
import { usePipelineStore } from '../store/pipelineStore';

// ─── Build graph with column-level edge map ───────────────────────────────────

function buildGraph(lineage) {
  const sources  = {};  // { tableName: { cols: Set, colNodes: Map<col, nodeId> } }
  const dims     = {};  // { tableName: { cols: Set, sources: Set } }
  const facts    = {};  // { tableName: { cols: Set, sources: Set } }
  // col lineage: "dwTable::col" → [{ srcTable, srcCol, transform }]
  const colLineage = {};

  Object.entries(lineage).forEach(([dwTable, tableData]) => {
    const nodes = tableData.nodes || [];
    const edges = tableData.edges || [];
    const type  = tableData.type || 'dimension';

    const nodeById = Object.fromEntries(nodes.map(n => [n.id, n]));
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

    // Build column-to-column lineage from edges
    edges.forEach(edge => {
      const fromNode = nodeById[edge.from];
      const toNode   = nodeById[edge.to];
      if (!fromNode || !toNode) return;
      if (toNode.kind !== 'target') return;

      const key = `${dwTable}::${toNode.label}`;
      if (!colLineage[key]) colLineage[key] = [];

      if (fromNode.kind === 'source') {
        colLineage[key].push({
          srcTable:  fromNode.table || 'source',
          srcCol:    fromNode.label,
          transform: edge.transform || 'DIRECT_LOAD',
        });
      } else if (fromNode.kind === 'target') {
        // FK reference to another DW table
        colLineage[key].push({
          srcTable:  fromNode.table || 'dw',
          srcCol:    fromNode.label,
          transform: edge.transform || 'LOOKUP_SK',
          isDwRef:   true,
        });
      }
    });
  });

  return { sources, dims, facts, colLineage };
}

// ─── Transform badge ─────────────────────────────────────────────────────────

const TRANSFORM_COLORS = {
  DIRECT_LOAD:           'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  GENERATE_SURROGATE_KEY:'bg-amber-500/15   text-amber-400   border-amber-500/25',
  DATE_PARSE:            'bg-cyan-500/15    text-cyan-400    border-cyan-500/25',
  RENAME_AND_CAST:       'bg-indigo-500/15  text-indigo-400  border-indigo-500/25',
  LOOKUP_SK:             'bg-purple-500/15  text-purple-400  border-purple-500/25',
  DEFAULT:               'bg-slate-500/15   text-slate-400   border-slate-500/25',
};

function TransformBadge({ transform }) {
  const cls = TRANSFORM_COLORS[transform] || TRANSFORM_COLORS.DEFAULT;
  return (
    <span className={`text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${cls}`}>
      {transform?.replace(/_/g, ' ') || 'DIRECT'}
    </span>
  );
}

// ─── Column List with lineage click ──────────────────────────────────────────

function ColList({ cols, max = 6, tableName, colLineage, onColSelect, selectedCol }) {
  const [expanded, setExpanded] = useState(false);
  const arr     = [...cols];
  const visible = expanded ? arr : arr.slice(0, max);
  const extra   = arr.length - max;

  return (
    <div className="space-y-0.5 mt-2">
      {visible.map(col => {
        const key        = `${tableName}::${col}`;
        const hasLineage = colLineage && colLineage[key]?.length > 0;
        const isSelected = selectedCol?.key === key;
        return (
          <div
            key={col}
            onClick={hasLineage ? (e) => { e.stopPropagation(); onColSelect?.(isSelected ? null : { key, col, table: tableName, lineage: colLineage[key] }); } : undefined}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-all group ${
              isSelected
                ? 'bg-indigo-500/20 border border-indigo-500/30 cursor-pointer'
                : hasLineage
                  ? 'bg-white/[0.03] hover:bg-indigo-500/10 hover:border-indigo-500/20 border border-transparent cursor-pointer'
                  : 'bg-white/[0.03] border border-transparent'
            }`}
          >
            <Hash size={8} className="text-slate-600 shrink-0" />
            <span className={`text-[9px] font-mono truncate flex-1 ${isSelected ? 'text-indigo-300' : 'text-slate-400'}`}>{col}</span>
            {hasLineage && (
              <MapPin size={7} className={`shrink-0 ${isSelected ? 'text-indigo-400' : 'text-slate-700 group-hover:text-indigo-400'} transition-colors`} />
            )}
          </div>
        );
      })}
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

function SourceCard({ name, info, selected, onClick, colLineage, onColSelect, selectedCol }) {
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
      <ColList cols={info.cols} max={5} tableName={name} colLineage={null} onColSelect={null} selectedCol={null} />
    </motion.div>
  );
}

// ─── DW Card ─────────────────────────────────────────────────────────────────

function DWCard({ name, info, isFact, selected, onClick, colLineage, onColSelect, selectedCol }) {
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
        ← {[...info.sources].join(', ')}
      </div>
      <ColList
        cols={info.cols}
        max={5}
        tableName={name}
        colLineage={colLineage}
        onColSelect={onColSelect}
        selectedCol={selectedCol}
      />
    </motion.div>
  );
}

// ─── Column Lineage Panel ─────────────────────────────────────────────────────

function ColLineagePanel({ colSel, onClose }) {
  if (!colSel) return null;
  const { col, table, lineage } = colSel;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        className="border border-indigo-500/30 bg-indigo-500/[0.06] rounded-2xl p-4 mt-3"
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Lignage de colonne</div>
            <div className="flex items-center gap-1.5">
              <MapPin size={10} className="text-indigo-400" />
              <span className="text-[12px] font-black text-white font-mono">{col}</span>
            </div>
            <div className="text-[8px] text-slate-600 mt-0.5 font-mono">dans {table}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-all">
            <X size={11} />
          </button>
        </div>

        <div className="space-y-2">
          {lineage.map((item, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap">
              {/* Source */}
              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${
                item.isDwRef
                  ? 'bg-purple-500/10 border-purple-500/25'
                  : 'bg-slate-800/60 border-slate-700/40'
              }`}>
                {item.isDwRef ? <Star size={9} className="text-purple-400 shrink-0" /> : <Database size={9} className="text-slate-400 shrink-0" />}
                <div>
                  <div className="text-[8px] font-black text-slate-500 uppercase">{item.srcTable}</div>
                  <div className="text-[10px] font-mono text-slate-200">{item.srcCol}</div>
                </div>
              </div>

              {/* Arrow + transform */}
              <div className="flex flex-col items-center gap-0.5 shrink-0">
                <ArrowRight size={12} className="text-indigo-400/50" />
                <TransformBadge transform={item.transform} />
              </div>

              {/* Target */}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/25">
                <Zap size={9} className="text-indigo-400 shrink-0" />
                <div>
                  <div className="text-[8px] font-black text-indigo-500 uppercase">{table}</div>
                  <div className="text-[10px] font-mono text-indigo-200">{col}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Detail Drawer (table-level) ──────────────────────────────────────────────

function DetailDrawer({ node, colLineage, onClose, onColSelect, selectedCol }) {
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
        className="absolute right-4 top-4 bottom-4 w-72 bg-[#0d0d14]/95 border border-white/10 rounded-2xl p-5 overflow-y-auto custom-scrollbar z-30 shadow-2xl"
      >
        <div className="flex items-start justify-between mb-3">
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

        {!isSource && (
          <p className="text-[8px] text-indigo-400/60 mb-2 flex items-center gap-1">
            <MapPin size={7} /> Cliquez sur une colonne pour voir son origine
          </p>
        )}

        <div className="space-y-1">
          {[...node.cols].map(col => {
            const key        = `${node.name}::${col}`;
            const hasLineage = !isSource && colLineage?.[key]?.length > 0;
            const isSelected = selectedCol?.key === key;
            return (
              <div
                key={col}
                onClick={hasLineage ? () => onColSelect?.(isSelected ? null : { key, col, table: node.name, lineage: colLineage[key] }) : undefined}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all group ${
                  isSelected
                    ? 'bg-indigo-500/25 border border-indigo-500/40 cursor-pointer'
                    : hasLineage
                      ? 'bg-white/[0.03] border border-white/[0.04] hover:bg-indigo-500/10 hover:border-indigo-500/20 cursor-pointer'
                      : 'bg-white/[0.03] border border-white/[0.04]'
                }`}
              >
                <Table2 size={9} className="text-slate-600 shrink-0" />
                <span className={`text-[10px] font-mono truncate flex-1 ${isSelected ? 'text-indigo-300' : 'text-slate-300'}`}>{col}</span>
                {hasLineage && (
                  <MapPin size={8} className={`shrink-0 transition-colors ${isSelected ? 'text-indigo-400' : 'text-slate-700 group-hover:text-indigo-400'}`} />
                )}
              </div>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LineageGraph() {
  const { lineage } = usePipelineStore();
  const [selected,    setSelected]    = useState(null);
  const [selectedCol, setSelectedCol] = useState(null);
  const [search,      setSearch]      = useState('');

  const { sources, dims, facts, colLineage } = useMemo(() => {
    if (!lineage || typeof lineage !== 'object') return { sources: {}, dims: {}, facts: {}, colLineage: {} };
    return buildGraph(lineage);
  }, [lineage]);

  const srcList  = Object.entries(sources).filter(([n]) => !search || n.toLowerCase().includes(search.toLowerCase()));
  const dimList  = Object.entries(dims).filter(([n])    => !search || n.toLowerCase().includes(search.toLowerCase()));
  const factList = Object.entries(facts).filter(([n])   => !search || n.toLowerCase().includes(search.toLowerCase()));
  const isEmpty  = Object.keys(sources).length === 0 && Object.keys(dims).length === 0;

  // Total columns with lineage info
  const tracedCols = Object.keys(colLineage).length;

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
            {Object.keys(sources).length} source{Object.keys(sources).length > 1 ? 's' : ''} →
            {Object.keys(dims).length} dim{Object.keys(dims).length > 1 ? 's' : ''} +
            {Object.keys(facts).length} fact{Object.keys(facts).length > 1 ? 's' : ''} ·
            <span className="text-indigo-400 ml-1">{tracedCols} colonnes tracées</span>
          </p>
        </div>
        {/* Search */}
        <div className="ml-auto flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-lg px-2.5 py-1.5">
          <Search size={10} className="text-slate-600" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filtrer tables..."
            className="bg-transparent text-[10px] text-slate-400 placeholder:text-slate-700 outline-none w-28"
          />
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-500"/><span className="text-[8px] font-black text-slate-500 uppercase">Source</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-500"/><span className="text-[8px] font-black text-slate-500 uppercase">Dimension</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500"/><span className="text-[8px] font-black text-slate-500 uppercase">Fact</span></div>
          <div className="flex items-center gap-1.5"><MapPin size={8} className="text-indigo-400"/><span className="text-[8px] font-black text-indigo-400 uppercase">Cliquer une colonne = trace</span></div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto custom-scrollbar p-6">

        {/* Column lineage panel (inline, above cards) */}
        {selectedCol && (
          <ColLineagePanel colSel={selectedCol} onClose={() => setSelectedCol(null)} />
        )}

        <div className="flex gap-6 items-start min-w-[580px] mt-3">

          {/* LEFT: Source Tables */}
          <div className="shrink-0 w-52">
            <div className="text-[8px] font-black text-slate-600 uppercase tracking-[0.25em] mb-3 flex items-center gap-2">
              <Database size={9}/> Sources ({Object.keys(sources).length})
            </div>
            <div className="space-y-2">
              {srcList.map(([name, info]) => (
                <SourceCard
                  key={name}
                  name={name}
                  info={info}
                  selected={selected?.name === name}
                  onClick={setSelected}
                  colLineage={null}
                  onColSelect={null}
                  selectedCol={null}
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
                  <Star size={9}/> Dimensions ({Object.keys(dims).length})
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 mb-5">
                  {dimList.map(([name, info]) => (
                    <DWCard
                      key={name}
                      name={name}
                      info={info}
                      isFact={false}
                      selected={selected?.name === name}
                      onClick={n => { setSelected(n); setSelectedCol(null); }}
                      colLineage={colLineage}
                      onColSelect={setSelectedCol}
                      selectedCol={selectedCol}
                    />
                  ))}
                </div>
              </>
            )}
            {factList.length > 0 && (
              <>
                <div className="text-[8px] font-black text-amber-500 uppercase tracking-[0.25em] mb-3 flex items-center gap-2">
                  <Star size={9} fill="currentColor"/> Facts ({Object.keys(facts).length})
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                  {factList.map(([name, info]) => (
                    <DWCard
                      key={name}
                      name={name}
                      info={info}
                      isFact={true}
                      selected={selected?.name === name}
                      onClick={n => { setSelected(n); setSelectedCol(null); }}
                      colLineage={colLineage}
                      onColSelect={setSelectedCol}
                      selectedCol={selectedCol}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Table Detail Drawer (right side) */}
      <DetailDrawer
        node={selected}
        colLineage={colLineage}
        onClose={() => { setSelected(null); setSelectedCol(null); }}
        onColSelect={setSelectedCol}
        selectedCol={selectedCol}
      />
    </div>
  );
}
