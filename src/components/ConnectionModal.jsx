// src/components/ConnectionModal.jsx — Enterprise-Grade Connection Interface (V4 PRO)
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Database, FileText, Globe, Loader2,
  CheckCircle2, ShieldCheck, Server,
  Cpu, HardDrive, UploadCloud, Info, Rocket, Zap as LucideZap,
  ChevronRight, Ban
} from 'lucide-react';
import { usePipelineStore } from '../store/pipelineStore';
import { apiClient } from '../api/client';

// Formate un nombre de secondes en "Xm YYs" ou "YYs"
const fmtElapsed = (s) => {
  if (!Number.isFinite(s)) return '';
  s = Math.max(0, Math.floor(s));
  return s < 60 ? `${s}s` : `${Math.floor(s/60)}m ${String(s%60).padStart(2,'0')}s`;
};

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
    label: 'Base SQL Server (.bak / .sql / .bacpac)',
    icon: Database,
    desc: 'Ingestion universelle multi-format',
    sub: 'Full Backup, Script T-SQL ou BACPAC portable',
    color: '#10b981'
  }
];

// Mapping extension → libellé humain affiché dans le badge « Format détecté »
const FORMAT_LABELS = {
  bak:    { label: '.BAK — Full Backup natif',     tint: 'emerald' },
  sql:    { label: '.SQL — Script T-SQL',          tint: 'sky' },
  bacpac: { label: '.BACPAC — Export portable',    tint: 'violet' },
};

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
  // État spécifique au .bak/.sql/.bacpac : résultat de la restauration + diagnostic versions
  // { success, restored_db, tables, message, error, source_format, diagnostic }
  // diagnostic : { backup_version, backup_version_label, server_version, server_version_label }
  const [restoreResult, setRestoreResult] = useState(null);
  const [restoreDbName, setRestoreDbName] = useState('');

  // Compteur temps écoulé + AbortController pour un upload annulable.
  // Raison : RESTORE DATABASE peut prendre 1-10 min sur un .bak volumineux ;
  // sans feedback visuel + sans cancel, l'utilisateur pensait que l'UI gelait.
  const [uploadElapsedMs, setUploadElapsedMs] = useState(0);
  const uploadAbortRef  = useRef(null);
  const uploadTimerRef  = useRef(null);
  const uploadStartRef  = useRef(0);

  useEffect(() => {
    if (!isUploading) {
      if (uploadTimerRef.current) { clearInterval(uploadTimerRef.current); uploadTimerRef.current = null; }
      setUploadElapsedMs(0);
      return;
    }
    uploadStartRef.current = Date.now();
    setUploadElapsedMs(0);
    uploadTimerRef.current = setInterval(() => {
      setUploadElapsedMs(Date.now() - uploadStartRef.current);
    }, 500);
    return () => {
      if (uploadTimerRef.current) { clearInterval(uploadTimerRef.current); uploadTimerRef.current = null; }
    };
  }, [isUploading]);

  const cancelUpload = () => {
    if (uploadAbortRef.current) {
      try { uploadAbortRef.current.abort(); } catch { /* noop */ }
      uploadAbortRef.current = null;
    }
  };

  // ──────────── Auto-fix Docker Bridge (streaming NDJSON) ────────────
  // Déclenché quand le preflight a détecté une incompatibilité de version :
  // lance un conteneur SQL Server à la version du backup, y restaure le .bak,
  // et bascule dwConfig vers le nouveau conteneur. Affiche la progression en
  // temps réel (phase + message) + timer + bouton Cancel.
  const [isBridging, setIsBridging] = useState(false);
  const [bridgeInfo, setBridgeInfo] = useState(null);
  const [bridgePhase, setBridgePhase] = useState('');       // ex: 'pull', 'run', 'wait_ready', 'restore'
  const [bridgeMessage, setBridgeMessage] = useState('');   // dernière ligne lisible pour l'utilisateur
  const [bridgeLog, setBridgeLog] = useState([]);           // historique (les 10 derniers événements)
  const [bridgeElapsedMs, setBridgeElapsedMs] = useState(0);
  const bridgeAbortRef = useRef(null);
  const bridgeTimerRef = useRef(null);
  const bridgeStartRef = useRef(0);

  useEffect(() => {
    if (!isBridging) {
      if (bridgeTimerRef.current) {
        clearInterval(bridgeTimerRef.current);
        bridgeTimerRef.current = null;
      }
      return;
    }
    bridgeStartRef.current = Date.now();
    setBridgeElapsedMs(0);
    bridgeTimerRef.current = setInterval(() => {
      setBridgeElapsedMs(Date.now() - bridgeStartRef.current);
    }, 500);
    return () => {
      if (bridgeTimerRef.current) clearInterval(bridgeTimerRef.current);
    };
  }, [isBridging]);

  // Libellés FR lisibles par phase backend
  const BRIDGE_PHASE_LABELS = {
    init:        'Initialisation',
    preflight:   'Vérification de Docker',
    resolve:     "Recherche de l'image SQL Server",
    pull:        "Téléchargement de l'image Docker",
    run:         'Démarrage du conteneur',
    wait_ready:  "Attente que SQL Server soit prêt",
    restore:     'Restauration du .bak dans le conteneur',
    inventory:   'Inventaire des tables',
    done:        'Terminé',
    error:       'Erreur',
    heartbeat:   'En cours',
  };

  const isVersionMismatch = () => {
    if (!restoreResult || restoreResult.success) return false;
    const d = restoreResult.diagnostic;
    if (!d) return false;
    const bm = parseInt(String(d.backup_version || '').split('.')[0] || '0', 10);
    const sm = parseInt(String(d.server_version || '').split('.')[0] || '0', 10);
    return bm > 0 && sm > 0 && bm > sm;
  };

  const cancelBridge = () => {
    try { bridgeAbortRef.current?.abort(); } catch { /* noop */ }
  };

  const triggerDockerBridge = async () => {
    if (!sourceConfig.file_path) return;
    setIsBridging(true);
    setError('');
    setBridgePhase('init');
    setBridgeMessage('Démarrage du pont Docker...');
    setBridgeLog([]);

    const ac = new AbortController();
    bridgeAbortRef.current = ac;

    const onEvent = (ev) => {
      if (!ev || !ev.phase) return;
      setBridgePhase(ev.phase);
      if (ev.message) setBridgeMessage(ev.message);
      setBridgeLog(prev => {
        const next = [...prev, ev];
        return next.length > 10 ? next.slice(-10) : next;
      });
    };

    try {
      const res = await apiClient.runBackupBridgeStream(
        sourceConfig.file_path,
        restoreDbName || null,
        onEvent,
        { signal: ac.signal }
      );

      if (res.restore_success && res.bridge_info) {
        setBridgeInfo(res.bridge_info);
        setDwConfig(prev => ({
          ...prev,
          host:     `${res.bridge_info.host},${res.bridge_info.port}`,
          user:     res.bridge_info.user,
          password: res.bridge_info.password,
          database: res.bridge_info.database,
        }));
        setRestoreResult({
          success:       true,
          restored_db:   res.restored_db,
          tables:        res.tables || [],
          message:       res.message || '',
          error:         '',
          source_format: 'bak',
          diagnostic:    restoreResult?.diagnostic || null,
        });
      } else {
        setError(res.restore_error || 'Le pont Docker a échoué.');
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Pont Docker annulé par l\'utilisateur.');
      } else {
        setError(`Auto-fix Docker : ${err.message || 'erreur inconnue'}`);
      }
    } finally {
      setIsBridging(false);
      bridgeAbortRef.current = null;
    }
  };

  const [dwConfig, setDwConfig] = useState({ 
    type:     'sqlserver',
    host:     import.meta.env.VITE_SQLSERVER_HOST     || '127.0.0.1',
    user:     import.meta.env.VITE_SQLSERVER_USER     || 'sa',
    password: import.meta.env.VITE_SQLSERVER_PASSWORD || 'Antigravity2026!',
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
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    try {
      if (source === 'bak') {
        // Route unifiée multi-format : .bak (RESTORE), .sql (exécution T-SQL), .bacpac (SqlPackage Import)
        const res = await apiClient.uploadBackup(
          file,
          restoreDbName || null,
          dwConfig.host,
          dwConfig.user,
          dwConfig.password,
          { signal: controller.signal }
        );
        setSourceConfig(prev => ({ ...prev, file_path: res.file_path, filename: res.filename }));
        setRestoreResult({
          success:       res.restore_success,
          restored_db:   res.restored_db,
          tables:        res.tables || [],
          message:       res.message || '',
          error:         res.restore_error || '',
          source_format: res.source_format || '',
          diagnostic:    res.diagnostic || null,
        });
        // Pré-remplir la base de données cible avec la DB restaurée
        if (res.restore_success && res.restored_db) {
          setDwConfig(prev => ({ ...prev, database: res.restored_db }));
        }
        if (!res.restore_success) {
          const reason = res.restore_error || res.detail || res.message || 'Erreur SQL Server inconnue — vérifiez les logs';
          setError(reason);
        }
      } else {
        // Route CSV standard
        const res = await apiClient.uploadFile(file);
        setSourceConfig(prev => ({ ...prev, file_path: res.file_path, filename: res.filename }));
      }
    } catch (err) {
      if (err?.name === 'AbortError') {
        setError("Upload annulé. Le fichier partiel a été abandonné — aucune base n'a été modifiée.");
      } else {
        setError(`Upload failed: ${err.message || 'Unknown error'}`);
      }
    } finally {
      uploadAbortRef.current = null;
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
                                <input type="file" onChange={handleFileUpload} accept={source === 'csv' ? '.csv' : '.bak,.sql,.bacpac'} className="hidden" />
                                {isUploading ? (
                                  <div className="space-y-4">
                                    <Loader2 className="animate-spin mx-auto text-indigo-400" size={48} />
                                    <div>
                                      <p className="text-xs font-black text-indigo-200 uppercase tracking-[0.3em]">
                                        {source === 'bak'
                                          ? (uploadElapsedMs < 3000 ? 'Upload en cours...' : 'Restauration SQL Server en cours')
                                          : 'Neural Processing...'}
                                      </p>
                                      {source === 'bak' && (
                                        <p className="mt-2 text-[10px] text-slate-400 font-medium leading-relaxed max-w-sm mx-auto">
                                          Le RESTORE DATABASE peut prendre <span className="text-slate-200 font-bold">plusieurs minutes</span> pour un backup volumineux — c'est normal. Ne fermez pas la fenêtre.
                                        </p>
                                      )}
                                    </div>
                                    {source === 'bak' && (
                                      <div className="flex items-center justify-center gap-3">
                                        <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-[10px] font-mono font-bold tracking-wider">
                                          ⏱ {fmtElapsed(uploadElapsedMs / 1000)}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); cancelUpload(); }}
                                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 hover:text-rose-200 text-[10px] font-bold uppercase tracking-widest transition-all"
                                        >
                                          <Ban size={11} /> Annuler
                                        </button>
                                      </div>
                                    )}
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
                                        {sourceConfig.filename || (source === 'csv'
                                          ? 'Drag CSV Dump / Logs'
                                          : 'Drag .BAK · .SQL · .BACPAC')}
                                      </p>
                                      <p className="text-[11px] text-slate-500 font-medium mt-1">
                                        {sourceConfig.filename
                                          ? restoreResult?.success
                                            ? `✅ DB restaurée : ${restoreResult.restored_db} (${restoreResult.tables.length} tables)`
                                            : restoreResult?.success === false
                                              ? `⚠️ Upload OK — restauration impossible (voir diagnostic ci-dessous)`
                                              : 'Fichier vérifié'
                                          : (source === 'csv'
                                              ? 'Strictement .CSV recommandé'
                                              : '3 formats acceptés : Full Backup (.bak), script T-SQL (.sql), export portable (.bacpac)')
                                        }
                                      </p>
                                    </div>

                                    {/* Badge "Format détecté" après upload (pour .bak/.sql/.bacpac) */}
                                    {source === 'bak' && restoreResult?.source_format && FORMAT_LABELS[restoreResult.source_format] && (
                                      <div className="flex justify-center">
                                        <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full border
                                          ${restoreResult.source_format === 'bak'    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : ''}
                                          ${restoreResult.source_format === 'sql'    ? 'bg-sky-500/10 border-sky-500/30 text-sky-300' : ''}
                                          ${restoreResult.source_format === 'bacpac' ? 'bg-violet-500/10 border-violet-500/30 text-violet-300' : ''}`}>
                                          Format détecté — {FORMAT_LABELS[restoreResult.source_format].label}
                                        </span>
                                      </div>
                                    )}

                                    {/* Diagnostic de versions SQL Server (affiché dès qu'on a un diagnostic, succès ou échec) */}
                                    {source === 'bak' && restoreResult?.diagnostic && (restoreResult.diagnostic.backup_version || restoreResult.diagnostic.server_version) && (
                                      <div className="mt-2 mx-auto max-w-md text-left bg-white/[0.02] border border-white/10 rounded-2xl p-3 space-y-1.5">
                                        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                                          <Info size={11} />
                                          <span>Diagnostic SQL Server</span>
                                        </div>
                                        {restoreResult.diagnostic.backup_version_label && (
                                          <div className="flex items-center justify-between text-[10px] font-mono">
                                            <span className="text-slate-500">Backup source :</span>
                                            <span className="text-slate-200 font-bold">{restoreResult.diagnostic.backup_version_label}
                                              {restoreResult.diagnostic.backup_version && (
                                                <span className="text-slate-500 font-normal ml-1">({restoreResult.diagnostic.backup_version})</span>
                                              )}
                                            </span>
                                          </div>
                                        )}
                                        {restoreResult.diagnostic.server_version_label && (
                                          <div className="flex items-center justify-between text-[10px] font-mono">
                                            <span className="text-slate-500">Serveur cible :</span>
                                            <span className="text-slate-200 font-bold">{restoreResult.diagnostic.server_version_label}
                                              {restoreResult.diagnostic.server_version && (
                                                <span className="text-slate-500 font-normal ml-1">({restoreResult.diagnostic.server_version})</span>
                                              )}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    )}

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

                {error && (
                  <div className="mt-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] font-semibold leading-relaxed whitespace-pre-wrap">
                    {error}
                  </div>
                )}

                {/* Bouton Auto-fix Docker : visible dès qu'on détecte une incompat de version */}
                {source === 'bak' && isVersionMismatch() && !bridgeInfo && (
                  <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-cyan-500/10 via-sky-500/10 to-indigo-500/10 border border-sky-500/30">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center flex-shrink-0">
                        <Cpu size={18} className="text-sky-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black text-sky-200 uppercase tracking-[0.2em]">
                          🚀 Auto-fix Docker (4ᵉ solution)
                        </p>
                        <p className="text-[11px] text-slate-300 font-medium mt-1.5 leading-relaxed">
                          Je peux démarrer automatiquement un conteneur SQL Server à la bonne version, y restaurer ton .bak, et basculer ta cible sur ce conteneur.
                          <span className="block mt-1 text-[10px] text-slate-400">
                            Nécessite Docker sur ta machine · ~5–10 min la première fois (pull de l'image ~1.5 Go).
                          </span>
                        </p>

                        {!isBridging && (
                          <button
                            type="button"
                            onClick={triggerDockerBridge}
                            className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-[11px] font-black uppercase tracking-widest shadow-lg shadow-sky-500/20 transition-all"
                          >
                            <Rocket size={14}/> Démarrer le pont Docker
                          </button>
                        )}

                        {isBridging && (
                          <div className="mt-3 space-y-3">
                            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-black/40 border border-sky-500/20">
                              <div className="flex items-center gap-3 min-w-0">
                                <Loader2 className="animate-spin text-sky-300 flex-shrink-0" size={18}/>
                                <div className="min-w-0">
                                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-200 truncate">
                                    {BRIDGE_PHASE_LABELS[bridgePhase] || bridgePhase || 'En cours'}
                                  </div>
                                  <div className="text-[11px] text-slate-300 font-medium truncate mt-0.5">
                                    {bridgeMessage || '…'}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="px-2.5 py-1 rounded-md bg-sky-500/20 border border-sky-500/40 text-sky-200 text-[10px] font-mono font-bold tabular-nums">
                                  ⏱ {fmtElapsed(bridgeElapsedMs / 1000)}
                                </span>
                                <button
                                  type="button"
                                  onClick={cancelBridge}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-[10px] font-black uppercase tracking-widest transition-colors"
                                  title="Annuler le pont Docker"
                                >
                                  <Ban size={12}/> Annuler
                                </button>
                              </div>
                            </div>

                            {/* Mini historique des derniers events — rassure l'utilisateur que ça avance */}
                            {bridgeLog.length > 0 && (
                              <div className="p-3 rounded-xl bg-black/30 border border-white/5 max-h-28 overflow-y-auto">
                                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">
                                  Journal
                                </div>
                                <div className="space-y-0.5 font-mono text-[10px]">
                                  {bridgeLog.slice().reverse().map((ev, i) => (
                                    <div key={i} className="flex gap-2 text-slate-400">
                                      <span className="text-sky-400/70 flex-shrink-0">[{BRIDGE_PHASE_LABELS[ev.phase] || ev.phase}]</span>
                                      <span className="truncate">{ev.message || ''}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Panneau d'info du bridge actif */}
                {bridgeInfo && (
                  <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
                      <ShieldCheck size={13} />
                      <span>Pont Docker actif — cible DW basculée</span>
                    </div>
                    <div className="mt-2 space-y-1 text-[10px] font-mono">
                      <div className="flex justify-between"><span className="text-slate-500">Conteneur :</span><span className="text-slate-200 font-bold">{bridgeInfo.container}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Image :</span><span className="text-slate-200 font-bold">{bridgeInfo.image}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Host :</span><span className="text-slate-200 font-bold">{bridgeInfo.host},{bridgeInfo.port}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Database :</span><span className="text-emerald-300 font-bold">{bridgeInfo.database}</span></div>
                    </div>
                    <p className="mt-3 text-[10px] text-slate-400 leading-relaxed">
                      La cible DW ci-dessous a été automatiquement mise à jour vers le conteneur bridge. Clique <span className="text-slate-200 font-bold">Next Step</span> pour continuer.
                    </p>
                  </div>
                )}
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
