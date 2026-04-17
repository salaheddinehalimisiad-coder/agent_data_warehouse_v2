// src/components/ConnectionModal.jsx — Enterprise-Grade Connection Interface (V4 PRO)
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Database, FileText, Globe, Loader2, 
  CheckCircle2, ShieldCheck, Server,
  Cpu, HardDrive, UploadCloud, Info, Rocket, Zap as LucideZap,
  ChevronRight
} from 'lucide-react';
import { usePipelineStore } from '../store/pipelineStore';
import { apiClient } from '../api/client';

const SOURCES = [
  { 
    id: 'csv',      
    label: 'Fichier CSV',     
    icon: FileText,    
    desc: 'Jeux de données plats',
    sub: 'Extractions ponctuelles (.csv)',
    color: '#6366f1'
  },
  { 
    id: 'bak',    
    label: 'Base SQL Server (.bak)',   
    icon: Database,   
    desc: 'Restauration complète (Full Backup)',
    sub: 'Cas métiers : RH, Finance, Ventes',
    color: '#10b981'
  }
];

export default function ConnectionModal({ isOpen, onClose }) {
  const { startPipeline, userPrefix } = usePipelineStore();
  const [step, setStep]           = useState(1);
  const [source, setSource]       = useState('csv');
  const [isUploading, setIsUploading] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError]         = useState('');
  const [isDragging, setIsDragging]   = useState(false);

  const [sourceConfig, setSourceConfig] = useState({
    host: '', user: '', password: '', database: '',
    file_path: '', filename: '',
    url: '', headers: '{}', root_key: '',
    port: '',
  });
  // État spécifique au .bak : résultat de la restauration
  const [restoreResult, setRestoreResult] = useState(null); // { success, restored_db, tables, message, error }
  const [restoreDbName, setRestoreDbName] = useState('');

  const [dwConfig, setDwConfig] = useState({ 
    host:     import.meta.env.VITE_SQLSERVER_HOST     || 'sqlserver',
    user:     import.meta.env.VITE_SQLSERVER_USER     || 'sa',
    password: import.meta.env.VITE_SQLSERVER_PASSWORD || 'StrongP@ssw0rd2026',
    database: import.meta.env.VITE_SQLSERVER_DB       || 'agent_dw_meta'
  });

  const nextStep = () => { setError(''); setStep(s => s + 1); };
  const prevStep = () => { setError(''); setStep(s => s - 1); };

  const setSrc = (k, v) => setSourceConfig(prev => ({ ...prev, [k]: v }));

  const doUpload = async (file) => {
    if (!file) return;
    setIsUploading(true);
    setError('');
    setRestoreResult(null);
    try {
      if (source === 'bak') {
        // Route dédiée : upload + RESTORE DATABASE automatique
        const res = await apiClient.uploadBackup(
          file, 
          restoreDbName || null,
          dwConfig.host,
          dwConfig.user,
          dwConfig.password
        );
        setSourceConfig(prev => ({ ...prev, file_path: res.file_path, filename: res.filename }));
        setRestoreResult({
          success:     res.restore_success,
          restored_db: res.restored_db,
          tables:      res.tables || [],
          message:     res.message || '',
          error:       res.restore_error || '',
        });
        // Pré-remplir la base de données cible avec la DB restaurée
        if (res.restore_success && res.restored_db) {
          setDwConfig(prev => ({ ...prev, database: res.restored_db }));
        }
        if (!res.restore_success) {
          setError(`Backup uploadé mais restauration échouée : ${res.restore_error}`);
        }
      } else {
        // Route CSV standard
        const res = await apiClient.uploadFile(file);
        setSourceConfig(prev => ({ ...prev, file_path: res.file_path, filename: res.filename }));
      }
    } catch (err) {
      setError(`Upload failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = (e) => doUpload(e.target.files[0]);
  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); doUpload(e.dataTransfer.files[0]); };

  const handleLaunch = async () => {
    setIsLaunching(true);
    setError('');
    
    let finalSourceConfig;
    if (source === 'csv' || source === 'bak') {
      if (!sourceConfig.file_path) { setError('Please upload a file.'); setIsLaunching(false); return; }
      finalSourceConfig = { type: source, file_path: sourceConfig.file_path, filename: sourceConfig.filename };
    }

    try {
      await startPipeline(finalSourceConfig, dwConfig);
      onClose();
    } catch (err) {
      setError('Strategic launch sequence failed. Verify credentials.');
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-2xl px-6" />

      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-[860px] glass-panel rounded-[40px] border border-white/5 overflow-hidden shadow-2xl bg-[#0a0a0f]">
        
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-600 to-emerald-500" />
        
        <div className="flex h-[580px]">
          {/* Sidebar */}
          <div className="w-[280px] bg-black/40 border-r border-white/5 p-10 flex flex-col justify-between">
             <div className="space-y-12">
                 <div className="flex flex-col gap-2">
                   <div className="w-14 h-14 rounded-[20px] bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center shadow-lg shadow-indigo-500/10">
                      <Cpu size={28} className="text-indigo-400" />
                   </div>
                   <h2 className="text-2xl font-black text-white italic tracking-tighter mt-6 uppercase leading-none">Neural Init</h2>
                   <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em]">Deployment Node v4.1</p>
                </div>
                <div className="space-y-6">
                   {[{ s: 1, l: 'Source Strategy', i: Database }, { s: 2, l: 'Configuration', i: HardDrive }, { s: 3, l: 'Neural Ignition', i: Rocket }].map(item => (
                      <div key={item.s} className={`flex items-center gap-4 transition-all ${step >= item.s ? 'opacity-100' : 'opacity-30'}`}>
                         <div className={`w-8 h-8 rounded-full flex items-center justify-center border text-[10px] font-black ${step === item.s ? 'bg-white text-black border-white' : 'text-white border-white/20'}`}>{item.s}</div>
                         <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{item.l}</span>
                      </div>
                   ))}
                </div>
             </div>
             <div className="flex items-center gap-2 text-slate-600">
                <ShieldCheck size={14} className="text-emerald-500/50" />
                <span className="text-[9px] font-black uppercase tracking-widest font-mono">Secure Transmission</span>
             </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-10 flex flex-col relative bg-gradient-to-br from-indigo-500/5 to-transparent">
             <button onClick={onClose} className="absolute top-8 right-8 p-2 rounded-xl text-slate-500 hover:text-white bg-white/5 hover:bg-white/10 transition-all"><X size={20} /></button>

             <div className="flex-1 pt-4 overflow-y-auto pr-2 custom-scrollbar">
                {step === 1 && (
                  <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
                     <div className="mb-2">
                        <span className="text-[10px] font-black text-indigo-500 tracking-[0.4em] uppercase">Step 01 / Selection</span>
                        <h3 className="text-3xl font-black text-white tracking-tight mt-2">Choose Intelligence Source</h3>
                        <p className="text-xs text-slate-500 mt-2 font-medium">Select the data medium for neural ingestion.</p>
                     </div>
                     <div className="grid grid-cols-1 gap-4">
                        {SOURCES.map(s => {
                           const Icon = s.icon;
                           const isActive = source === s.id;
                           return (
                              <motion.button 
                                key={s.id} 
                                onClick={() => setSource(s.id)} 
                                whileHover={{ x: 4 }}
                                whileTap={{ scale: 0.98 }}
                                className={`group flex items-center gap-5 p-5 rounded-[28px] border transition-all relative overflow-hidden ${
                                  isActive 
                                  ? 'bg-white/[0.03] border-indigo-500/50 shadow-xl shadow-indigo-500/5' 
                                  : 'bg-white/[0.02] border-white/5 hover:border-white/20'
                                }`}
                              >
                                 {isActive && (
                                   <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-transparent pointer-events-none" />
                                 )}
                                 
                                 <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                                   isActive ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-slate-500 group-hover:text-slate-300'
                                 }`}>
                                    <Icon size={24} />
                                 </div>
                                 
                                 <div className="text-left flex-1">
                                    <p className={`text-[13px] font-black uppercase tracking-wider ${isActive ? 'text-white' : 'text-slate-400'}`}>
                                      {s.label}
                                    </p>
                                    <p className="text-[10px] text-slate-500 group-hover:text-slate-400 transition-colors mt-0.5">
                                      {s.desc} • <span className="opacity-70">{s.sub}</span>
                                    </p>
                                 </div>
                                 
                                 {isActive ? (
                                   <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center shadow-lg">
                                      <CheckCircle2 size={14} className="text-white" />
                                   </div>
                                 ) : (
                                   <ChevronRight size={16} className="text-slate-700 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                 )}
                              </motion.button>
                           )
                        })}
                     </div>
                  </motion.div>
                )}

                {step === 2 && (
                   <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                      <div>
                         <span className="text-[10px] font-black text-indigo-400 tracking-[0.3em] uppercase">Phase 02</span>
                         <h3 className="text-2xl font-black text-white tracking-tight mt-1">Configure & Target</h3>
                      </div>
                      
                      {/* Source Params */}
                       <div className="space-y-4">
                        {(source === 'csv' || source === 'bak') && (
                          <div className={`relative p-1 rounded-[32px] transition-all group overflow-hidden ${
                            isDragging ? 'bg-indigo-500/20 ring-2 ring-indigo-500/50' : 'bg-white/[0.02] border border-white/10'
                          }`}
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} 
                            onDragLeave={() => setIsDragging(false)} 
                            onDrop={handleDrop}
                          >
                             <label className="block p-12 cursor-pointer text-center relative z-10">
                                <input type="file" onChange={handleFileUpload} accept={source === 'csv' ? '.csv' : '.bak'} className="hidden" />
                                {isUploading ? (
                                  <div className="space-y-4">
                                    <Loader2 className="animate-spin mx-auto text-indigo-500" size={40} />
                                    <p className="text-xs font-black text-indigo-300 uppercase tracking-widest">Neural Processing...</p>
                                  </div>
                                ) : (
                                 <div className="space-y-4">
                                    <div className={`w-16 h-16 rounded-3xl mx-auto flex items-center justify-center transition-all ${
                                      sourceConfig.filename 
                                        ? restoreResult?.success === false
                                          ? 'bg-rose-500/20 text-rose-400'
                                          : 'bg-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/10' 
                                        : 'bg-white/5 text-slate-600 group-hover:bg-indigo-500/10 group-hover:text-indigo-400'
                                    }`}>
                                       {sourceConfig.filename 
                                         ? restoreResult?.success === false ? <X size={32}/> : <ShieldCheck size={32}/>
                                         : <UploadCloud size={32}/>}
                                    </div>
                                    <div>
                                      <p className="text-lg font-black text-white italic tracking-tight">
                                        {sourceConfig.filename || `Drag ${source.toUpperCase()} Dump/Logs`}
                                      </p>
                                      <p className="text-[11px] text-slate-500 font-medium mt-1">
                                        {sourceConfig.filename 
                                          ? restoreResult?.success
                                            ? `✅ DB restaurée : ${restoreResult.restored_db} (${restoreResult.tables.length} tables)`
                                            : restoreResult?.success === false
                                              ? `⚠️ Upload OK — restauration en attente`
                                              : 'Fichier vérifié'
                                          : `Strictement ${source.toUpperCase()} recommandé`
                                        }
                                      </p>
                                    </div>
                                    {restoreResult?.success && restoreResult.tables.length > 0 && (
                                      <div className="mt-2 max-h-24 overflow-y-auto custom-scrollbar">
                                        <div className="flex flex-wrap gap-1 justify-center">
                                          {restoreResult.tables.slice(0, 8).map(t => (
                                            <span key={t} className="px-2 py-0.5 text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full font-mono">{t.split('.').pop()}</span>
                                          ))}
                                          {restoreResult.tables.length > 8 && (
                                            <span className="px-2 py-0.5 text-[9px] bg-white/5 border border-white/10 text-slate-400 rounded-full">+{restoreResult.tables.length - 8} autres</span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    {!sourceConfig.filename && (
                                      <div className="mt-4 px-6 py-2 bg-indigo-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest inline-block shadow-lg shadow-indigo-500/20 transition-transform active:scale-95">
                                        Browse Files
                                      </div>
                                    )}
                                  </div>
                                )}
                             </label>
                             <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
                             <div className="absolute -left-10 -top-10 w-40 h-40 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
                          </div>
                        )}

                        {source === 'bak' && (
                          <div className="mt-3">
                            <input
                              type="text"
                              value={restoreDbName}
                              onChange={(e) => setRestoreDbName(e.target.value)}
                              placeholder="Nom DB cible (optionnel, ex: dw_sales_2026)"
                              className="w-full h-11 px-4 rounded-xl bg-black border border-white/10 focus:border-emerald-500 text-sm font-semibold"
                            />
                          </div>
                        )}
                      </div>

                      {/* Target Params */}
                      <div className="pt-6 border-t border-white/5 space-y-4">
                        <div className="flex items-center gap-2"><Server size={14} className="text-slate-500"/><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Enterprise DW Target</span></div>
                        <div className="grid grid-cols-2 gap-3">
                           {[{l:'Infrastructure',k:'host'}, {l:'Warehouse DB',k:'database'}, {l:'Auth ID',k:'user'}, {l:'Security',k:'password',t:'password'}].map(f => (
                             <input key={f.k} type={f.t || 'text'} value={dwConfig[f.k]} onChange={e => setDwConfig({...dwConfig, [f.k]: e.target.value})} placeholder={f.l} className="h-11 px-4 rounded-xl bg-black border border-white/5 focus:border-indigo-500 text-sm font-bold" />
                           ))}
                        </div>
                      </div>
                   </motion.div>
                )}

                {error && <div className="mt-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-bold">{error}</div>}
             </div>

             {/* Footer */}
             <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between">
                <div>{step > 1 && <button onClick={prevStep} className="px-6 py-3 rounded-2xl text-slate-500 hover:text-white font-black text-[11px] uppercase tracking-widest">Back</button>}</div>
                {step < 3 ? (
                  <button onClick={nextStep} className="flex items-center gap-3 px-8 py-4 bg-white text-black rounded-2xl font-black text-[12px] uppercase tracking-widest hover:bg-slate-200">Next Step</button>
                ) : (
                  <button onClick={handleLaunch} disabled={isLaunching} className="flex items-center gap-4 px-10 py-5 bg-indigo-600 text-white rounded-[28px] font-black text-[13px] uppercase tracking-widest hover:bg-indigo-500 shadow-xl shadow-indigo-500/20">
                     {isLaunching ? <Loader2 className="animate-spin" size={18} /> : "🎁"} BEGIN SYNTHESIS
                  </button>
                )}
             </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
