import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Book, Table, Layout, Tag, Grid } from 'lucide-react';
import { usePipelineStore } from '../store/pipelineStore';

export default function DataCatalog() {
  const { dataCatalog, pipelineStatus } = usePipelineStore();
  const [search, setSearch] = useState('');
  const [selectedTable, setSelectedTable] = useState(null);

  const tables = dataCatalog?.tables || [];

  const filteredTables = useMemo(() => {
    if (!search.trim()) return tables;
    const q = search.toLowerCase();
    return tables.filter(t => 
      t.name.toLowerCase().includes(q) || 
      t.description.toLowerCase().includes(q) ||
      t.columns.some(c => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
    );
  }, [tables, search]);

  if (!dataCatalog || tables.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-12 opacity-40">
        <Book size={48} className="text-zinc-600 mb-4" />
        <h3 className="text-xl font-black text-white italic tracking-tighter uppercase">Catalogue Intelligent en Attente</h3>
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mt-2">
            L'indexation neuronale se produira après un pipeline réussi.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#050508] p-8 overflow-hidden">
      {/* HEADER & SEARCH */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
           <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                 <Book size={20} className="text-indigo-400" />
              </div>
              <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Catalogue Neuronal</h2>
           </div>
           <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Inventaire Sémantique Généré par IA</p>
        </div>

        <div className="relative group w-full md:w-96">
           <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-indigo-400 transition-colors" />
           <input 
             value={search}
             onChange={e => setSearch(e.target.value)}
             placeholder="Rechercher tables, colonnes, métriques..."
             className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-zinc-700"
           />
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 overflow-hidden">
        {/* TABLE LIST */}
        <div className="lg:col-span-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
          {filteredTables.map(table => (
             <motion.button
               key={table.name}
               whileHover={{ x: 4 }}
               onClick={() => setSelectedTable(table)}
               className={`w-full text-left p-5 rounded-3xl border transition-all ${
                 selectedTable?.name === table.name 
                 ? 'bg-indigo-600 border-indigo-400 shadow-xl shadow-indigo-500/20' 
                 : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
               }`}
             >
               <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-xl ${selectedTable?.name === table.name ? 'bg-white/20' : 'bg-white/5'}`}>
                     <Table size={14} className={selectedTable?.name === table.name ? 'text-white' : 'text-zinc-500'} />
                  </div>
                  <h4 className="text-[13px] font-black tracking-tight text-white uppercase truncate">{table.name}</h4>
               </div>
               <p className={`text-[11px] font-medium leading-relaxed line-clamp-2 ${selectedTable?.name === table.name ? 'text-indigo-100' : 'text-zinc-500'}`}>
                 {table.description}
               </p>
             </motion.button>
          ))}
        </div>

        {/* DETAILS VIEW */}
        <div className="lg:col-span-2 bg-white/[0.02] border border-white/5 rounded-[40px] overflow-hidden flex flex-col relative">
           <AnimatePresence mode="wait">
             {selectedTable ? (
               <motion.div 
                 key={selectedTable.name}
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: -20 }}
                 className="h-full flex flex-col p-10"
               >
                  <div className="flex items-center justify-between mb-8">
                     <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Détails de l'Entité</span>
                     <div className="flex gap-2">
                        <Tag size={12} className="text-zinc-700" />
                        <span className="text-[10px] font-black text-zinc-700 uppercase">{selectedTable.name.startsWith('dim') ? 'DIMENSION' : 'FACT'}</span>
                     </div>
                  </div>

                  <h3 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-4">{selectedTable.name}</h3>
                  <p className="text-lg text-zinc-400 font-medium leading-relaxed mb-12 max-w-2xl">
                    {selectedTable.description}
                  </p>

                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                     <div className="flex items-center gap-2 mb-6">
                        <Layout size={16} className="text-indigo-400" />
                        <h5 className="text-[11px] font-black text-white uppercase tracking-widest">Schéma Sémantique</h5>
                     </div>
                     
                     <div className="grid grid-cols-1 gap-4">
                        {selectedTable.columns.map(col => (
                           <div key={col.name} className="group p-5 bg-white/[0.03] border border-white/5 rounded-2xl hover:border-indigo-500/30 transition-all">
                              <div className="flex justify-between items-start mb-1">
                                 <span className="text-[12px] font-black text-white uppercase tracking-tight group-hover:text-indigo-400 transition-colors">
                                    {col.name}
                                 </span>
                                 <span className="text-[8px] font-black text-zinc-700 uppercase tracking-widest">Colonne</span>
                              </div>
                              <p className="text-[11px] text-zinc-500 font-medium italic">
                                 {col.description}
                              </p>
                           </div>
                        ))}
                     </div>
                  </div>
               </motion.div>
             ) : (
               <div className="h-full flex flex-col items-center justify-center p-20 text-center opacity-20">
                  <Grid size={64} className="text-zinc-400 mb-6" />
                  <h3 className="text-xl font-black text-white uppercase italic">Sélectionnez une entité</h3>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-2">Explorez la structure sémantique de votre entrepôt</p>
               </div>
             )}
           </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
