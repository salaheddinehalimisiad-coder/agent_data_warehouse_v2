// src/components/DataExplorer.jsx — Enterprise-Grade Schema Inspector (V3 Premium)
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, Table2, Hash, ChevronRight, ChevronDown, 
  Star, Key, Link, Search, Filter, Layers, 
  Target, Layout, Info, Activity, ShieldCheck
} from 'lucide-react';
import { usePipelineStore } from '../store/pipelineStore';

function TypeBadge({ dtype }) {
  const d = (dtype || '').toLowerCase();
  const isNumeric = /int|float|decimal|numeric|bigint/.test(d);
  const isDate    = /date|time|timestamp/.test(d);
  const isText    = /char|text|varchar|string/.test(d);

  const cls = isNumeric ? 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20'
            : isDate    ? 'text-purple-400 bg-purple-400/10 border-purple-400/20'
            : isText    ? 'text-amber-400 bg-amber-400/10 border-amber-400/20'
            :             'text-slate-500 bg-white/5 border-white/10';

  return (
    <span className={`text-[8px] px-2 py-0.5 rounded-full border font-black tracking-tighter ${cls}`}>
      {(dtype || '').split('(')[0].toUpperCase()}
    </span>
  );
}

function RoleBadge({ role }) {
  if (role === 'pk') return <div className="p-1 rounded-lg bg-yellow-400/20 border border-yellow-400/20"><Star size={10} className="text-yellow-500" /></div>;
  if (role === 'fk') return <div className="p-1 rounded-lg bg-cyan-400/20 border border-cyan-400/20"><Link size={10} className="text-cyan-400" /></div>;
  return <div className="w-5" />;
}

function TableCard({ tableName, tableData, isFactTable }) {
  const [expanded, setExpanded] = useState(isFactTable);
  const columns = tableData?.columns || [];
  const metrics = {
    pk: columns.filter(c => c.role === 'pk').length,
    fk: columns.filter(c => c.role === 'fk').length,
  };

  return (
    <div className={`group rounded-3xl border transition-all duration-300 ${
      isFactTable
        ? 'border-indigo-500/30 bg-indigo-500/[0.03]'
        : 'border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/10'
    }`}>
      <button onClick={() => setExpanded(e => !e)} className="w-full flex items-center justify-between p-4 px-5 text-left">
        <div className="flex items-center gap-4 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all ${
            isFactTable ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 border-white/10 text-slate-500'
          }`}>
             <Table2 size={16} />
          </div>
          <div>
            <div className={`text-[12px] font-black tracking-tight ${isFactTable ? 'text-white' : 'text-slate-300'}`}>
              {tableName.toUpperCase()}
            </div>
            <div className="flex items-center gap-2 mt-1">
               <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{columns.length} Fields</span>
               {isFactTable && <span className="text-[8px] px-1.5 py-0.5 rounded bg-indigo-500 text-white font-black tracking-tighter">FACT</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
           {metrics.fk > 0 && <span className="text-[9px] font-bold text-cyan-400 font-mono italic opacity-50">{metrics.fk}FK</span>}
           <div className={`p-1.5 rounded-lg transition-transform ${expanded ? 'rotate-180 bg-white/5' : 'bg-transparent text-slate-600'}`}>
              <ChevronDown size={14} />
           </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-5 pb-5 pt-1 space-y-1.5">
               <div className="h-px bg-white/[0.06] mb-3 mx-[-20px]" />
               {columns.map((col, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.02] transition-colors border border-transparent hover:border-white/[0.04]">
                     <div className="flex items-center gap-3 min-w-0">
                        <RoleBadge role={col.role} />
                        <span className="text-[11.5px] font-bold text-slate-400 font-mono truncate">{col.name}</span>
                     </div>
                     <TypeBadge dtype={col.type || col.dtype} />
                  </div>
               ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function DataExplorer() {
  const { logicalModel, sqlDDL, etlStatus, schemaDriftDetected } = usePipelineStore();
  const [search, setSearch] = useState('');
  
  const factTable = logicalModel?.fact_table;
  const dimTables = logicalModel?.dimension_tables || [];
  const hasModel  = !!factTable;

  const filteredDim = dimTables.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col h-full bg-black/20 backdrop-blur-3xl p-6">
      
      {/* Header Inspector */}
      <div className="space-y-6 mb-8">
         <div className="flex items-center justify-between">
            <div>
               <h3 className="text-lg font-black text-white italic tracking-tighter uppercase underline decoration-indigo-500/50 underline-offset-8 decoration-4">Architect Inspector</h3>
            </div>
            <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-500">
               <Layout size={18} />
            </div>
         </div>

         {/* Search Filter HUD */}
         <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-indigo-400 transition-colors" size={14} />
            <input 
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="FILTER SCHEMA..."
              className="w-full bg-white/[0.02] border border-white/[0.08] rounded-2xl pl-11 pr-4 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] placeholder:text-slate-800 focus:bg-white/[0.04] transition-all"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-black/40 border border-white/10">
               <Filter size={10} className="text-slate-600" />
            </div>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pb-8">
        {!hasModel ? (
          <div className="h-60 flex flex-col items-center justify-center py-10 px-8 text-center glass-card rounded-[40px] border-dashed border-white/5">
             <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 flex items-center justify-center mb-6">
                <Layers size={28} className="text-indigo-400/40" />
             </div>
             <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest mb-1 italic">Logical Abyss</h4>
             <p className="text-[10px] text-slate-600 font-medium leading-relaxed max-w-[180px]">Synthesize a connection to populate the structural inspector.</p>
          </div>
        ) : (
          <div className="space-y-4">
             {/* Key Indicators */}
             <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-3xl p-4 flex flex-col gap-1">
                   <Target size={14} className="text-indigo-400" />
                   <span className="text-lg font-black text-white italic tracking-tighter">01 FACT</span>
                   <span className="text-[9px] font-black text-indigo-400/60 uppercase tracking-widest">Entry Point</span>
                </div>
                <div className="bg-white/[0.03] border border-white/[0.08] rounded-3xl p-4 flex flex-col gap-1">
                   <Database size={14} className="text-slate-500" />
                   <span className="text-lg font-black text-white italic tracking-tighter">{dimTables.length} DIMS</span>
                   <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Dimensions</span>
                </div>
             </div>

             <div className="space-y-2">
                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] ml-2">Core Entity</span>
                <TableCard tableName={factTable.name} tableData={factTable} isFactTable />
             </div>

             <div className="space-y-3 pt-4">
                <div className="flex items-center gap-3 px-2 mb-2">
                   <div className="h-px flex-1 bg-white/[0.06]" />
                   <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest italic">Dimension Pool</span>
                   <div className="h-px w-8 bg-white/[0.06]" />
                </div>
                {filteredDim.map((dim, i) => (
                  <TableCard key={i} tableName={dim.name} tableData={dim} isFactTable={false} />
                ))}
             </div>
          </div>
        )}
      </div>

      {/* Footer System Status */}
      <div className="mt-auto pt-6 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className={`w-2 h-2 rounded-full ${hasModel ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-800'}`} />
             <span className="text-[9px] font-black text-slate-700 uppercase tracking-[0.2em]">SCHEMA HUD</span>
          </div>
          {schemaDriftDetected && (
             <div className="flex items-center gap-1.5 text-[9px] font-black text-amber-500 uppercase italic">
                <Activity size={10} /> DRIFT CAPTURED
             </div>
          )}
      </div>
    </div>
  );
}
