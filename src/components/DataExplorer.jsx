import { AnimatePresence, motion } from 'framer-motion';
import { Activity, ChevronDown, ChevronRight, 
  Database, Filter, Hash, Info, Key, Layers, Layout, Link, Search, ShieldCheck,
  Star, Table2, 
  Target 
} from 'lucide-react';
// src/components/DataExplorer.jsx — Enterprise-Grade Schema Inspector (V3 Premium)
import { useState } from 'react';
import { usePipelineStore } from '../store/pipelineStore';

function TypeBadge({ dtype }) {
  const d = (dtype || '').toLowerCase();
  const isNumeric = /int|float|decimal|numeric|bigint/.test(d);
  const isDate    = /date|time|timestamp/.test(d);
  const isText    = /char|text|varchar|string/.test(d);

  const accent = isNumeric ? 'var(--cyan-500)' : isDate ? 'var(--purple-500)' : isText ? 'var(--orange-400)' : 'var(--text-muted)';
  const accentBg   = isNumeric ? 'rgba(6,182,212,0.1)' : isDate ? 'rgba(168,85,247,0.1)' : isText ? 'rgba(251,191,36,0.1)' : 'var(--bg-higher)';
  const accentBorder = isNumeric ? 'rgba(6,182,212,0.2)' : isDate ? 'rgba(168,85,247,0.2)' : isText ? 'rgba(251,191,36,0.2)' : 'var(--border-subtle)';

  return (
    <span className="text-[8px] px-2 py-0.5 rounded-full border font-black tracking-tighter"
      style={{ color: accent, background: accentBg, borderColor: accentBorder }}>
      {(dtype || '').split('(')[0].toUpperCase()}
    </span>
  );
}

function RoleBadge({ role }) {
  if (role === 'pk') return <div className="p-1 rounded-lg" style={{ background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.2)' }}><Star size={10} style={{ color: 'var(--yellow-500)' }} /></div>;
  if (role === 'fk') return <div className="p-1 rounded-lg" style={{ background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.2)' }}><Link size={10} style={{ color: 'var(--cyan-500)' }} /></div>;
  return <div className="w-5" />;
}

function TableCard({ tableName, tableData, isFactTable }) {
  const [expanded, setExpanded] = useState(isFactTable);
  const columns = tableData?.columns || [];
  
  return (
    <div className="group rounded-3xl border transition-all duration-300"
      style={isFactTable
        ? { borderColor: 'rgba(61,106,232,0.3)', background: 'rgba(61,106,232,0.08)' }
        : { borderColor: 'var(--border-subtle)', background: 'var(--bg-elevated)' }
      }
      onMouseEnter={e => { if(!isFactTable) { e.currentTarget.style.background = 'var(--bg-higher)'; }}}
      onMouseLeave={e => { if(!isFactTable) { e.currentTarget.style.background = 'var(--bg-elevated)'; }}}
    >
      <button onClick={() => setExpanded(e => !e)} className="w-full flex items-center justify-between p-4 px-5 text-left">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center border transition-all"
            style={isFactTable
              ? { background: 'var(--blue-500)', borderColor: 'var(--blue-400)', color: '#fff', boxShadow: '0 4px 14px rgba(61,106,232,0.2)' }
              : { background: 'var(--bg-higher)', borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }
            }>
             <Table2 size={16} />
          </div>
          <div>
            <div className="text-[12px] font-black tracking-tight" style={{ color: isFactTable ? 'var(--text-primary)' : 'var(--text-primary)' }}>
              {tableName.toUpperCase()}
            </div>
            <div className="flex items-center gap-2 mt-1">
               <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{columns.length} Champs</span>
               {isFactTable && <span className="text-[8px] px-1.5 py-0.5 rounded font-black tracking-tighter" style={{ background: 'var(--blue-500)', color: '#fff' }}>FACT</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="p-1.5 rounded-lg transition-transform"
             style={expanded ? { background: 'var(--bg-higher)', transform: 'rotate(180deg)' } : { background: 'transparent', color: 'var(--text-muted)' }}>
              <ChevronDown size={14} />
           </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-5 pb-5 pt-1 space-y-1.5">
               <div className="h-px mb-3 mx-[-20px]" style={{ background: 'var(--border-subtle)' }} />
               {columns.map((col, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-xl transition-colors"
                    style={{ border: '1px solid transparent' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-higher)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}>
                     <div className="flex items-center gap-3 min-w-0">
                        <RoleBadge role={col.role} />
                        <span className="text-[11.5px] font-bold font-mono truncate" style={{ color: 'var(--text-secondary)' }}>{col.name}</span>
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
  const { sourceMetadata } = usePipelineStore();
  const [search, setSearch] = useState('');
  
  const hasMetadata = sourceMetadata && Object.keys(sourceMetadata).length > 0;
  const tableNames  = hasMetadata ? Object.keys(sourceMetadata) : [];
  const filteredTables = tableNames.filter(name => name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col h-full p-6" style={{ background: 'var(--bg-base)' }}>

      {/* Header Inspector */}
      <div className="space-y-6 mb-8">
         <div className="flex items-center justify-between">
            <div>
               <h3 className="text-lg font-black italic tracking-tighter uppercase underline decoration-indigo-500/50 underline-offset-8 decoration-4" style={{ color: 'var(--text-primary)' }}>Source Discovery</h3>
            </div>
            <div className="p-2 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
               <Database size={18} />
            </div>
         </div>

         {/* Search Filter HUD */}
         <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" size={14} style={{ color: 'var(--text-dim)' }} />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="RECHERCHER SOURCE RAW..."
              className="w-full rounded-2xl pl-11 pr-4 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] transition-all"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            />
         </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pb-8">
        {!hasMetadata ? (
          <div className="h-60 flex flex-col items-center justify-center py-10 px-8 text-center rounded-[40px] border-dashed" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
             <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-6" style={{ background: 'rgba(61,106,232,0.1)' }}>
                <Layers size={28} style={{ color: 'var(--blue-500)', opacity: 0.4 }} />
             </div>
             <h4 className="text-xs font-black uppercase tracking-widest mb-1 italic" style={{ color: 'var(--text-secondary)' }}>Aucune Source Ingérée</h4>
             <p className="text-[10px] font-medium leading-relaxed max-w-[180px]" style={{ color: 'var(--text-muted)' }}>Lancez l'explorateur pour analyser les métadonnées source.</p>
          </div>
        ) : (
          <div className="space-y-4">
             <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="rounded-3xl p-4 flex flex-col gap-1" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                   <Activity size={14} style={{ color: 'var(--green-500)' }} />
                   <span className="text-lg font-black italic tracking-tighter" style={{ color: 'var(--text-primary)' }}>{tableNames.length} TABLES</span>
                   <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--green-500)', opacity: 0.7 }}>Détectées</span>
                </div>
                <div className="rounded-3xl p-4 flex flex-col gap-1" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                   <Target size={14} style={{ color: 'var(--text-muted)' }} />
                   <span className="text-lg font-black italic tracking-tighter" style={{ color: 'var(--text-primary)' }}>RAW</span>
                   <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Métadonnées</span>
                </div>
             </div>

             {filteredTables.map((name, i) => (
               <TableCard key={i} tableName={name} tableData={sourceMetadata[name]} isFactTable={false} />
             ))}
          </div>
        )}
      </div>

      {/* Footer System Status */}
      <div className="mt-auto pt-6 border-t flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full" style={{ background: hasMetadata ? 'var(--green-500)' : 'var(--text-dim)' }} />
             <span className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-dim)' }}>HUD SOURCE</span>
          </div>
      </div>
    </div>
  );
}
