// src/components/ConnectionModal.jsx — Enterprise-Grade Connection Interface (V4 PRO)
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Database, FileText, Globe, Loader2, 
  CheckCircle2, ShieldCheck, Server,
  Cpu, HardDrive, UploadCloud, Info, Rocket, Zap as LucideZap
} from 'lucide-react';
import { usePipelineStore } from '../store/pipelineStore';
import { apiClient } from '../api/client';

const SOURCES = [
  { id: 'csv',      label: 'CSV Dataset',     icon: FileText,    desc: 'Upload a .csv file for AI-powered analysis',          color: 'indigo'  },
  { id: 'excel',    label: 'Excel Workbook',   icon: HardDrive,   desc: 'Upload .xlsx or .xls files — all sheets detected',     color: 'emerald' },
  { id: 'mysql',    label: 'MySQL Database',   icon: Database,    desc: 'Connect to a MySQL or MariaDB instance',               color: 'blue'    },
  { id: 'postgresql',label:'PostgreSQL',       icon: Database,    desc: 'Connect to a PostgreSQL or managed cloud DB',          color: 'cyan'    },
  { id: 'rest_api', label: 'REST API',          icon: Globe,       desc: 'Fetch JSON data from a REST endpoint (GET)',            color: 'violet'  },
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

  const [dwConfig, setDwConfig] = useState({ 
    host:     import.meta.env.VITE_MYSQL_HOST     || '127.0.0.1',
    user:     import.meta.env.VITE_MYSQL_USER     || 'root',
    password: import.meta.env.VITE_MYSQL_PASSWORD || '',
    database: import.meta.env.VITE_MYSQL_DB       || 'dw_staging_v3'
  });

  const nextStep = () => { setError(''); setStep(s => s + 1); };
  const prevStep = () => { setError(''); setStep(s => s - 1); };

  const setSrc = (k, v) => setSourceConfig(prev => ({ ...prev, [k]: v }));

  const doUpload = async (file) => {
    if (!file) return;
    setIsUploading(true);
    setError('');
    try {
      const res = await apiClient.uploadFile(file);
      setSourceConfig(prev => ({ ...prev, file_path: res.file_path, filename: res.filename }));
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
    if (source === 'csv' || source === 'excel') {
      if (!sourceConfig.file_path) { setError('Please upload a file.'); setIsLaunching(false); return; }
      finalSourceConfig = { type: source, file_path: sourceConfig.file_path, filename: sourceConfig.filename };
    } else if (source === 'rest_api') {
      if (!sourceConfig.url) { setError('URL is required.'); setIsLaunching(false); return; }
      let headers = {};
      try { headers = JSON.parse(sourceConfig.headers || '{}'); } catch { headers = {}; }
      finalSourceConfig = { type: 'rest_api', url: sourceConfig.url, headers, root_key: sourceConfig.root_key || null };
    } else {
      if (!sourceConfig.host || !sourceConfig.database) { setError('Host and DB name required.'); setIsLaunching(false); return; }
      finalSourceConfig = {
        type: source,
        host: sourceConfig.host,
        port: sourceConfig.port || (source === 'postgresql' ? 5432 : 3306),
        user: sourceConfig.user,
        password: sourceConfig.password,
        database: sourceConfig.database
      };
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
                   <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                      <Cpu size={24} className="text-indigo-400" />
                   </div>
                   <h2 className="text-xl font-black text-white italic tracking-tighter mt-4 uppercase">Initializer</h2>
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
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                     <div>
                        <span className="text-[10px] font-black text-indigo-400 tracking-[0.3em] uppercase">Phase 01</span>
                        <h3 className="text-2xl font-black text-white tracking-tight mt-1">Select Input Source</h3>
                     </div>
                     <div className="grid grid-cols-1 gap-3">
                        {SOURCES.map(s => {
                           const Icon = s.icon;
                           const isActive = source === s.id;
                           return (
                              <button key={s.id} onClick={() => setSource(s.id)} 
                                className={`flex items-center gap-4 p-4 rounded-3xl border transition-all ${isActive ? 'bg-indigo-500/10 border-indigo-500/40 text-white' : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/20'}`}>
                                 <div className={`p-3 rounded-xl ${isActive ? 'bg-indigo-500 text-white' : 'bg-white/5'}`}><Icon size={20} /></div>
                                 <div className="text-left">
                                    <p className="text-xs font-black uppercase tracking-widest">{s.label}</p>
                                    <p className="text-[10px] opacity-60">{s.desc}</p>
                                 </div>
                                 {isActive && <CheckCircle2 size={18} className="ml-auto text-indigo-500" />}
                              </button>
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
                        {(source === 'csv' || source === 'excel') ? (
                          <div className={`p-1 border-2 border-dashed rounded-3xl transition-all ${isDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10'}`}
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}>
                             <label className="block p-8 cursor-pointer text-center">
                                <input type="file" onChange={handleFileUpload} accept={source === 'csv' ? '.csv' : '.xlsx,.xls'} className="hidden" />
                                {isUploading ? <Loader2 className="animate-spin mx-auto text-indigo-500" size={32} /> : 
                                 <div className="space-y-2">
                                   {sourceConfig.filename ? <CheckCircle2 className="mx-auto text-emerald-500" size={32}/> : <UploadCloud className="mx-auto text-slate-500" size={32}/>}
                                   <p className="text-sm font-bold text-white">{sourceConfig.filename || `Drop ${source.toUpperCase()} here`}</p>
                                 </div>}
                             </label>
                          </div>
                        ) : source === 'rest_api' ? (
                          <div className="space-y-3">
                             <input type="url" value={sourceConfig.url} onChange={e => setSrc('url', e.target.value)} placeholder="API Endpoint URL" className="w-full h-11 px-4 rounded-xl bg-black border border-white/10 text-sm" />
                             <textarea value={sourceConfig.headers} onChange={e => setSrc('headers', e.target.value)} placeholder='Headers {"X-API-Key": "..."}' className="w-full px-4 py-2 rounded-xl bg-black border border-white/10 text-xs font-mono" rows={2}/>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-3">
                             {[{l:'Host',k:'host'}, {l:'Database',k:'database'}, {l:'User',k:'user'}, {l:'Pass',k:'password',t:'password'}].map(f => (
                               <input key={f.k} type={f.t || 'text'} value={sourceConfig[f.k]} onChange={e => setSrc(f.k, e.target.value)} placeholder={f.l} className="h-11 px-4 rounded-xl bg-black border border-white/10 text-sm" />
                             ))}
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
