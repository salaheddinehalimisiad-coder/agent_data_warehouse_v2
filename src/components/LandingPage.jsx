// src/components/LandingPage.jsx
import React, { useState, useEffect } from 'react';
import { 
  Network, Search, Shield, Zap, Database, ArrowRight, Terminal, 
  Cloud, HardDrive, Globe, Cpu, BrainCircuit, Blocks, Sparkles,
  BarChart4, ArrowUpRight, CheckCircle2, Workflow, MessageSquare, 
  Code2, PlayCircle, Waves, Edit3, Loader2, Link2, GitBranch, Rocket, UserCheck, Settings2,
  Sun, Moon, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.2 } }
};

export default function LandingPage({ onEnterDashboard, onSelectSource, user, onAuthOpen, onDocsOpen, onUseCaseOpen, isDarkMode, setIsDarkMode }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('explorer');
  const [isPaused, setIsPaused] = useState(false);

  const scrollToSection = (e, id) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const agents = {
    explorer: { 
      icon: Search, title: "Explorer Agent", desc: "Scanne instantanément vos sources de données, identifie les schémas existants et extrait les métadonnées de dizaines de bases SQL, NoSQL ou CSV sans effort humain.", 
      color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" 
    },
    drift_detector: { 
      icon: Waves, title: "Drift Detector", desc: "Surveille les écarts de schémas en temps réel et prévient les ruptures de pipeline avant qu'elles n'atteignent la production.", 
      color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" 
    },
    modeler: { 
      icon: Network, title: "Modeler Agent", desc: "Construit une architecture dimensionnelle parfaite (Flocon/Étoile). Conçoit les tables de faits et les dimensions avec une précision d'architecte data senior.", 
      color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" 
    },
    critic: { 
      icon: Shield, title: "Critic Agent", desc: "Il doute de tout. Cet agent audite le schéma généré, corrige les relations manquantes, optimise les clés primaires et garantit l'intégrité.", 
      color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" 
    },
    human_review: { 
      icon: CheckCircle2, title: "Human Review", desc: "Système de validation collaborative permettant à un expert d'approuver ou rectifier les décisions critiques de l'IA (HITL).", 
      color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" 
    },
    chat_modifier: { 
      icon: MessageSquare, title: "Chat Modifier", desc: "Affinez vos modèles par simple conversation. L'IA comprend vos directives métier et ajuste la structure (DDL) instantanément.", 
      color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20" 
    },
    etl_tsql_generator: { 
      icon: Code2, title: "ETL Generator", desc: "Traduit automatiquement les modèles logiques en code de transformation robuste (XML Pentaho natif).", 
      color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" 
    },
    etl_executor: { 
      icon: PlayCircle, title: "ETL Executor", desc: "Orchestre l'exécution des flux ETL générés avec un monitoring de performance granulaire, sans jamais crasher.", 
      color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/20" 
    },
    healer: { 
      icon: Zap, title: "Healer Agent", desc: "Tolérance aux pannes native. Si le script ETL plante en base de données, le Healer analyse les logs SQL et réécrit son code automatiquement.", 
      color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" 
    }
  };

  useEffect(() => {
    if (isPaused) return;
    const agentKeys = Object.keys(agents);
    const interval = setInterval(() => {
      setActiveTab(prev => {
        const currentIndex = agentKeys.indexOf(prev);
        const nextIndex = (currentIndex + 1) % agentKeys.length;
        return agentKeys[nextIndex];
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [isPaused]);

  return (
    <div className="relative w-full h-screen flex flex-col items-center overflow-x-hidden overflow-y-auto selection:bg-indigo-500/30 font-sans transition-colors duration-500" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      
      {/* Background Ambience Layer */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 w-[200%] md:w-full -translate-x-1/2 h-full bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:80px_80px] opacity-40 [mask-image:radial-gradient(ellipse_80%_100%_at_50%_0%,#000_20%,transparent_100%)]"></div>
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/10 blur-[200px]"></div>
        <div className="absolute top-[40%] right-[-20%] w-[50%] h-[50%] rounded-full bg-cyan-600/10 blur-[180px]"></div>
        <div className="absolute bottom-[-10%] left-[10%] w-[40%] h-[40%] rounded-full bg-purple-600/10 blur-[150px]"></div>
      </div>

      {/* Header Navigation */}
      <nav className="fixed top-0 inset-x-0 z-[100] w-full border-b backdrop-blur-2xl transition-colors duration-500" style={{ background: 'var(--bg-base)', opacity: 0.85, borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
          <div className="flex items-center cursor-pointer relative z-20" onClick={onEnterDashboard}>
            <img src="/logo-hero.svg" alt="Agent BI" className="h-16 md:h-20 lg:h-24 w-auto object-contain drop-shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:scale-105 transition-all" />
          </div>
          
          <div className="hidden lg:flex items-center gap-10 text-sm font-semibold text-zinc-400 relative z-20">
            <button onClick={(e) => scrollToSection(e, 'platform')} className="hover:text-white transition-colors cursor-pointer">Plateforme IA</button>
            <button onClick={onDocsOpen} className="hover:text-white transition-colors cursor-pointer">Documentation</button>
            <button onClick={onUseCaseOpen} className="hover:text-white transition-colors cursor-pointer">Cas d'utilisation</button>
          </div>

          <div className="flex items-center gap-6 relative z-20">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="relative p-2 rounded-full border transition-all duration-300 overflow-hidden hover:scale-105 shadow-sm"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}
              title={isDarkMode ? "Mode Clair" : "Mode Sombre"}
            >
              <div className="relative w-6 h-6 flex items-center justify-center">
                <Sun className={`absolute transition-all duration-500 ease-in-out text-amber-500 ${isDarkMode ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50'}`} size={18} />
                <Moon className={`absolute transition-all duration-500 ease-in-out text-indigo-500 ${isDarkMode ? 'opacity-0 -rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'}`} size={18} />
              </div>
            </button>
            
            {user ? null : (
              <button onClick={onAuthOpen} className="text-sm font-semibold text-zinc-300 hover:text-white transition-colors hidden sm:block">Se connecter</button>
            )}

            <button onClick={onSelectSource} className="text-sm font-bold bg-white text-black px-6 py-2.5 rounded-full hover:bg-slate-100 transition-all shadow-glow active:scale-95">
              Sélectionner source
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-48 pb-32 flex flex-col items-center">
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="w-full flex flex-col items-center text-center">
          <motion.h1 variants={fadeInUp} className="text-5xl sm:text-6xl md:text-7xl lg:text-[85px] font-extrabold tracking-tight leading-[1.05] mb-8 max-w-5xl">
            Où vos données brutes <br className="hidden md:block" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-400">
              deviennent un ROI évident.
            </span>
          </motion.h1>
          <motion.p variants={fadeInUp} className="text-lg md:text-xl text-zinc-500 dark:text-zinc-400 max-w-3xl mb-12 font-medium leading-relaxed">
            Être vu par vos utilisateurs n'est plus suffisant. Transformez instantanément vos bases brutes en un Data Warehouse optimisé grâce à nos 9 ingénieurs IA autonomes.
          </motion.p>
          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
            <button onClick={onSelectSource} className="group relative flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[20px] font-semibold text-lg transition-all shadow-lg hover:shadow-indigo-500/25 overflow-hidden active:scale-[0.98]">
              <Database size={20} className="group-hover:-translate-y-0.5 transition-transform text-indigo-200" /> Commencer gratuitement <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button onClick={onEnterDashboard} className="flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-4 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-900 dark:text-white rounded-[20px] font-semibold text-lg transition-colors active:scale-[0.98]">
              <PlayCircle size={20} className="text-zinc-500 dark:text-zinc-400" /> Voir la démo
            </button>
          </motion.div>
        </motion.div>
      </main>

      {/* Slideshow Section */}
      <section id="platform" className="relative z-10 w-full py-32 border-y transition-colors duration-500" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', scrollMarginTop: '108px' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20 flex flex-col items-center">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 text-zinc-900 dark:text-white">Orchestration Parfaite</h2>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">Laissez nos 9 agents IA spécialisés travailler en harmonie pour ingérer, modéliser et déployer votre Data Warehouse sans aucune intervention manuelle.</p>
          </div>

          <div className="flex flex-col items-center">
            <div 
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              className="w-full max-w-3xl h-[400px] bg-white dark:bg-[#09090b] rounded-[32px] border border-zinc-200 dark:border-white/10 p-10 relative flex items-center justify-center overflow-hidden shadow-2xl group transition-all duration-500 hover:border-indigo-500/30"
            >
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none"></div>
              <AnimatePresence mode="wait">
                {activeTab === 'explorer' && (
                  <motion.div key="explorer" initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: -20 }} className="w-full h-full flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(52,211,153,0.1)_0,transparent_60%)]"></div>
                    <Search size={120} className="text-emerald-500/30 mb-12" />
                    <div className="flex gap-8 mb-10 relative z-10">
                       {[Database, Cloud, HardDrive, Globe].map((Ic, i) => (
                          <motion.div key={i} animate={{ y: [0, -15, 0] }} transition={{ duration: 2.5, delay: i*0.3, repeat: Infinity }} className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center backdrop-blur-md">
                             <Ic size={32} className="text-emerald-400"/>
                          </motion.div>
                       ))}
                    </div>
                    <div className="w-80 h-3 bg-zinc-800/50 rounded-full overflow-hidden relative z-10 border border-white/5">
                      <motion.div initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 2, repeat: Infinity }} className="h-full bg-emerald-500"></motion.div>
                    </div>
                    <p className="mt-6 font-mono text-emerald-400 text-sm font-bold tracking-widest relative z-10 uppercase italic">Ingesting Deep Metadata...</p>
                  </motion.div>
                )}

                {activeTab === 'modeler' && (
                  <motion.div key="modeler" initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: -20 }} className="w-full h-full flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.1)_0,transparent_60%)]"></div>
                    <Network size={140} className="text-blue-500/20 absolute blur-[2px]" />
                    <div className="grid grid-cols-3 gap-10 relative z-10 scale-125">
                      <motion.div animate={{ rotateY: [0, 360] }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }} className="w-32 h-32 bg-blue-500/20 rounded-[32px] border-2 border-blue-500/40 backdrop-blur-xl flex flex-col items-center justify-center shadow-[0_0_50px_rgba(59,130,246,0.2)]">
                        <Blocks size={40} className="text-blue-300 mb-3"/>
                        <span className="text-[12px] uppercase font-black text-blue-100">Fact_Sales</span>
                      </motion.div>
                      <div className="w-28 h-28 bg-[#121214] rounded-3xl border border-zinc-700 flex flex-col items-center justify-center translate-y-20">
                        <span className="text-[11px] uppercase font-bold text-zinc-500">Dim_Date</span>
                      </div>
                      <div className="w-28 h-28 bg-[#121214] rounded-3xl border border-zinc-700 flex flex-col items-center justify-center -translate-y-20">
                        <span className="text-[11px] uppercase font-bold text-zinc-500">Dim_Prod</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'critic' && (
                  <motion.div key="critic" initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: -20 }} className="w-full h-full flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.1)_0,transparent_60%)]"></div>
                    <div className="w-96 bg-[#18181b]/80 backdrop-blur-2xl border border-purple-500/30 rounded-3xl p-8 shadow-2xl relative z-10">
                      <div className="flex items-center gap-4 mb-8 border-b border-white/5 pb-5">
                        <Shield className="text-purple-400" size={24}/>
                        <span className="text-lg font-black text-white uppercase tracking-widest">Critic Report</span>
                      </div>
                      <div className="space-y-6">
                        <div className="flex items-center gap-4 text-base font-bold"><CheckCircle2 size={24} className="text-emerald-500"/> Mapping Correct</div>
                        <div className="flex items-center gap-4 text-base font-bold"><CheckCircle2 size={24} className="text-emerald-500"/> PK/FK Constrain OK</div>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, repeat: Infinity, repeatType: "reverse", duration: 1 }} className="flex items-center gap-4 text-base font-bold text-purple-400 font-mono italic">
                           {">>"} SYNTHESIZING DDL...
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'healer' && (
                  <motion.div key="healer" initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full h-full flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(244,63,94,0.1)_0,transparent_60%)]"></div>
                    <Zap size={200} className="text-rose-500/10 absolute animate-pulse rotate-12" />
                    <div className="relative z-10 text-center w-full max-w-lg">
                      <div className="flex flex-col items-center p-10 bg-[#09090b]/80 rounded-[40px] border border-rose-500/30 backdrop-blur-3xl shadow-2xl">
                        <Terminal size={48} className="text-rose-400 mb-8" />
                        <div className="bg-black text-rose-300 font-mono text-sm w-full p-6 rounded-2xl text-left border border-white/10 mb-8">
                           {">"} ERROR 1064 (42000)<br/>
                           {">"} FIXING SCHÉMA AUTO...
                        </div>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="flex items-center justify-center gap-4 text-emerald-400 text-lg font-black w-full bg-emerald-500/10 py-5 rounded-2xl">
                          <CheckCircle2 size={24} /> RESOLVED BY AI
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'drift_detector' && (
                  <motion.div key="drift" initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }} className="w-full h-full flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.1)_0,transparent_60%)]"></div>
                    <div className="w-full max-w-lg flex items-center justify-between relative z-10 p-10">
                       <div className="w-32 h-32 rounded-[32px] bg-[#121214] border border-zinc-700 shadow-xl flex flex-col items-center justify-center">
                          <Database size={40} className="text-zinc-500 mb-2"/>
                          <span className="text-[10px] font-mono text-zinc-400 uppercase">Input_DB</span>
                       </div>
                       <div className="flex-1 px-8 relative overflow-hidden h-10 flex items-center">
                         <div className="absolute w-full h-1 bg-cyan-500/20 left-0 top-1/2 -translate-y-1/2"></div>
                         <motion.div animate={{ x: ['-20%', '120%'] }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }} className="absolute z-10 text-cyan-400 top-1/2 -translate-y-1/2">
                           <Waves size={32} />
                         </motion.div>
                       </div>
                       <div className="w-32 h-32 rounded-[32px] bg-[#121214] border-2 border-cyan-500 shadow-glow flex flex-col items-center justify-center relative overflow-hidden">
                          <div className="absolute inset-0 bg-cyan-500/5 animate-pulse"></div>
                          <GitBranch size={40} className="text-cyan-400 mb-2 relative z-10"/>
                          <span className="text-[10px] font-mono text-cyan-200 relative z-10 uppercase tracking-tighter">DW_Sync</span>
                       </div>
                    </div>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-12 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono text-sm px-8 py-4 rounded-2xl relative z-10">
                      {">"} DRIFT DETECTED: NEW FIELD REVENUE_2<br/>
                      {">"} AUTO-SCALING DW INFRA...
                    </motion.div>
                  </motion.div>
                )}

                {activeTab === 'human_review' && (
                  <motion.div key="human" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="w-full h-full flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.1)_0,transparent_60%)]"></div>
                    <div className="bg-[#121214] border border-amber-500/30 rounded-[40px] w-[450px] overflow-hidden shadow-2xl relative z-10 scale-110">
                       <div className="bg-[#18181b] p-6 text-center border-b border-white/5">
                          <span className="text-sm font-black text-amber-500 uppercase flex items-center justify-center gap-3 tracking-[0.2em]"><UserCheck size={20}/> Manual Verification Required</span>
                       </div>
                       <div className="p-10">
                          <p className="text-sm text-zinc-300 mb-8 font-medium">L'Agent Modélisateur a suggéré une mise à jour de clé primaire. Confirmez-vous ?</p>
                          <div className="flex gap-4">
                             <motion.button whileHover={{ scale: 1.05 }} className="flex-1 py-4 text-[10px] font-black bg-amber-500 text-black rounded-2xl uppercase tracking-widest shadow-glow">Approuver</motion.button>
                             <motion.button whileHover={{ scale: 1.05 }} className="flex-1 py-4 text-[10px] font-black bg-white/5 text-white border border-white/10 rounded-2xl uppercase tracking-widest hover:bg-white/10">Rejeter</motion.button>
                          </div>
                       </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'chat_modifier' && (
                  <motion.div key="chat" initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }} className="w-full h-full flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.1)_0,transparent_60%)]"></div>
                    <div className="w-[450px] h-72 bg-[#121214] border border-indigo-500/30 rounded-[40px] flex flex-col shadow-2xl relative z-10 overflow-hidden scale-110">
                       <div className="h-12 bg-indigo-500/10 border-b border-indigo-500/20 flex items-center px-6 gap-3">
                          <MessageSquare size={16} className="text-indigo-400"/>
                          <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest text-[9px]">Neural Interactor</span>
                       </div>
                       <div className="flex-1 p-8 flex flex-col justify-end gap-6 overflow-hidden">
                          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="bg-zinc-800/80 self-start p-4 rounded-3xl text-[11px] text-zinc-200 max-w-[85%] rounded-tl-none border border-white/5">
                            Audit found redundancies. Fusion DIM_USER and DIM_PROFIL?
                          </motion.div>
                          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.2 }} className="bg-indigo-600 self-end p-4 rounded-3xl text-[11px] text-white max-w-[85%] rounded-tr-none shadow-glow font-bold">
                            Yes, and name it DIM_ACCOUNT.
                          </motion.div>
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} className="flex items-center gap-3">
                            <span className="flex gap-1.5">
                               <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, delay: 0 }} className="w-2 h-2 bg-indigo-400 rounded-full"/>
                               <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, delay: 0.2 }} className="w-2 h-2 bg-indigo-400 rounded-full"/>
                               <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, delay: 0.4 }} className="w-2 h-2 bg-indigo-400 rounded-full"/>
                            </span>
                            <span className="text-[10px] text-indigo-400 font-mono font-black italic">GENERIC DDL UPDATING...</span>
                          </motion.div>
                       </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'etl_tsql_generator' && (
                  <motion.div key="generator" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full h-full flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.1)_0,transparent_60%)]"></div>
                    <div className="relative w-[400px] h-56 bg-[#0d0d12] border-2 border-orange-500/30 rounded-[40px] overflow-hidden shadow-2xl z-10 scale-110">
                       <div className="absolute left-0 top-0 bottom-0 w-10 bg-black/40 border-r border-orange-500/20 flex flex-col items-center py-4 gap-1 text-[9px] text-zinc-700 font-mono font-black">
                         {Array.from({length: 8}).map((_, i) => <span key={i}>{i+1}</span>)}
                       </div>
                       <div className="pl-14 pt-6 pr-6 font-mono text-[11px] text-zinc-400 space-y-1">
                          <div><span className="text-pink-400">&lt;step&gt;</span></div>
                          <div className="pl-4"><span className="text-orange-300">&lt;name&gt;</span>TableInput<span className="text-orange-300">&lt;/name&gt;</span></div>
                          <div className="pl-4"><span className="text-blue-300">&lt;type&gt;</span>Database<span className="text-blue-300">&lt;/type&gt;</span></div>
                          <div className="pl-4"><span className="text-green-300">&lt;sql&gt;</span>SELECT * FROM dw.sales<span className="text-green-300">&lt;/sql&gt;</span></div>
                          <div><span className="text-pink-400">&lt;/step&gt;</span></div>
                       </div>
                       <motion.div 
                         animate={{ top: ['0%', '100%'] }} 
                         transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }} 
                         className="absolute left-0 right-0 h-16 bg-gradient-to-b from-transparent to-orange-500/10 pointer-events-none"
                       />
                       <div className="absolute bottom-0 right-0 bg-orange-500 text-black text-[10px] font-black px-4 py-1 rounded-tl-2xl shadow-glow uppercase tracking-widest italic">
                          PDI XML READY
                       </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'etl_executor' && (
                  <motion.div key="executor" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="w-full h-full flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(244,114,182,0.1)_0,transparent_60%)]"></div>
                    <div className="w-[450px] relative z-10 flex flex-col gap-5 scale-110">
                       {[
                         { step: 'Extract source data (API_SYNC)', delay: 0 },
                         { step: 'Join Surrogate Keys (DIM_LOAD)', delay: 0.8 },
                         { step: 'Batch Inserting Fact Table', delay: 1.6 }
                       ].map((item, index) => (
                           <motion.div 
                            key={index} 
                            initial={{ opacity: 0, x: -30 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: item.delay }}
                            className="bg-[#121214]/60 backdrop-blur-2xl border border-pink-500/20 p-5 rounded-3xl flex items-center justify-between"
                           >
                              <span className="text-xs text-white uppercase tracking-widest font-black italic">{item.step}</span>
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: item.delay + 0.4 }}
                              >
                                <CheckCircle2 size={24} className="text-emerald-400 shadow-glow"/>
                              </motion.div>
                           </motion.div>
                       ))}
                       <div className="mt-4">
                          <div className="w-full h-3 bg-zinc-800/80 rounded-full border border-white/5 overflow-hidden">
                             <motion.div 
                               initial={{ width: 0 }}
                               animate={{ width: '100%' }}
                               transition={{ duration: 2.5, ease: 'linear', repeat: Infinity }}
                               className="h-full bg-pink-500 shadow-glow"
                             />
                          </div>
                          <p className="text-center mt-3 text-[9px] font-mono text-pink-400 font-bold tracking-[0.2em] italic uppercase animate-pulse">Neural Pipeline Executing at 1.2M rows/sec</p>
                       </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-12 w-full max-w-4xl text-center">
               <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="flex flex-col items-center"
                  >
                     <div className="flex items-center gap-5 mb-6">
                        <div className={`p-3 rounded-[24px] border transition-all duration-700 bg-white/[0.05] border-white/10 ${agents[activeTab].color}`}>
                           {React.createElement(agents[activeTab].icon, { size: 38 })}
                        </div>
                        <h3 className={`text-5xl font-black italic tracking-tighter transition-colors ${agents[activeTab].color}`}>
                           {agents[activeTab].title}
                        </h3>
                     </div>
                     <p className="text-lg md:text-xl text-zinc-400 max-w-2xl leading-relaxed font-bold tracking-tight">
                        {agents[activeTab].desc}
                     </p>
                     
                     <div className="flex gap-3 mt-10">
                        {Object.keys(agents).map(key => (
                           <button 
                             key={key} 
                             onClick={() => setActiveTab(key)}
                             className={`h-1.5 transition-all duration-500 rounded-full ${activeTab === key ? 'w-16 bg-white shadow-glow' : 'w-3 bg-white/10 hover:bg-white/20'}`} 
                           />
                        ))}
                     </div>
                  </motion.div>
               </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof / Marquee */}
      <section className="relative z-10 w-full border-y border-white/5 bg-white/[0.01] py-10 overflow-hidden">
        <div className="absolute left-0 top-0 w-32 h-full bg-gradient-to-r from-black to-transparent z-10"></div>
        <div className="absolute right-0 top-0 w-32 h-full bg-gradient-to-l from-black to-transparent z-10"></div>
        <div className="flex whitespace-nowrap opacity-40">
          <motion.div animate={{ x: [0, -1000] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="flex items-center gap-24 text-2xl font-black text-zinc-500 uppercase tracking-widest px-12">
            <span>Cloudflare</span><span>Samsung</span><span>ZoomInfo</span><span>Roche</span><span>Hertz</span><span>Stripe</span><span>DataBricks</span><span>Stripe</span><span>Cloudflare</span><span>Samsung</span><span>ZoomInfo</span>
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative w-full py-32 border-b transition-colors duration-500" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-black mb-6">Choisissez le Plan Idéal</h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto mb-20 font-medium">
            Débloquez la puissance de l'IA pour votre Data Warehouse. Des tarifs clairs, adaptés au marché algérien, sans surprises.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch max-w-5xl mx-auto text-left">
             <div className="bg-[#121214] border border-white/5 rounded-[32px] p-8 flex flex-col hover:border-indigo-500/50 transition-all duration-500 hover:-translate-y-2">
                <h3 className="text-xl font-bold text-white mb-2">Mensuel</h3>
                <div className="flex items-baseline gap-2 mb-6">
                   <span className="text-4xl font-black text-white">1 500 DA</span>
                   <span className="text-sm text-zinc-500 font-bold">/ utilisateur / par mois</span>
                </div>
                <button className="w-full py-4 rounded-xl bg-white text-black font-black uppercase tracking-widest text-sm hover:scale-[1.02] transition-transform mb-8">Essayer Gratuitement</button>
                <div className="space-y-4 text-sm text-zinc-400 font-medium flex-1">
                   <div className="flex items-start gap-3"><CheckCircle2 size={18} className="text-emerald-500 shrink-0"/> Essai gratuit de 3 jours</div>
                   <div className="flex items-start gap-3"><CheckCircle2 size={18} className="text-emerald-500 shrink-0"/> Accès illimité aux graphes IA</div>
                   <div className="flex items-start gap-3"><CheckCircle2 size={18} className="text-emerald-500 shrink-0"/> Synchronisation de 5 sources max</div>
                   <div className="flex items-start gap-3"><CheckCircle2 size={18} className="text-emerald-500 shrink-0"/> Support communautaire</div>
                </div>
                <div className="mt-8 text-[11px] text-zinc-600 font-medium border-t border-white/5 pt-4">Facturé mois par mois. Annulation à tout moment.</div>
             </div>

             <div className="bg-gradient-to-b from-[#18181b] to-[#121214] border border-indigo-500/50 shadow-[0_0_50px_rgba(99,102,241,0.15)] rounded-[32px] p-8 flex flex-col relative transform md:-translate-y-4 hover:-translate-y-6 transition-all duration-500 z-10">
                <div className="absolute top-0 right-8 -translate-y-1/2 bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-glow">Populaire</div>
                <h3 className="text-xl font-bold text-white mb-2">Annuel</h3>
                <div className="flex items-baseline gap-2 mb-2">
                   <span className="text-5xl font-black text-white">1 000 DA</span>
                   <span className="text-sm text-zinc-500 font-bold">/ utilisateur / par mois</span>
                </div>
                <div className="text-indigo-400 text-[11px] font-black uppercase tracking-widest mb-4 bg-indigo-500/10 inline-block px-3 py-1 rounded-full w-fit">Économisez 33% !</div>
                <button onClick={onSelectSource} className="w-full py-4 rounded-xl bg-indigo-500 text-white shadow-glow font-black uppercase tracking-widest text-sm hover:scale-[1.02] hover:bg-indigo-400 transition-transform mb-8">Essayer Gratuitement</button>
                <div className="space-y-4 text-sm text-zinc-300 font-medium flex-1">
                   <div className="flex items-start gap-3"><CheckCircle2 size={18} className="text-emerald-500 shrink-0"/> Essai gratuit de 3 jours</div>
                   <div className="flex items-start gap-3"><CheckCircle2 size={18} className="text-emerald-500 shrink-0"/> Accès illimité aux graphes IA & Auto-Correction</div>
                   <div className="flex items-start gap-3"><CheckCircle2 size={18} className="text-emerald-500 shrink-0"/> Sources de données illimitées</div>
                   <div className="flex items-start gap-3"><CheckCircle2 size={18} className="text-emerald-500 shrink-0"/> Exécution de flux ETL en temps réel</div>
                   <div className="flex items-start gap-3"><CheckCircle2 size={18} className="text-emerald-500 shrink-0"/> Support prioritaire 24/7</div>
                </div>
                <div className="mt-8 text-[11px] text-zinc-500 font-medium border-t border-white/10 pt-4">Facturé 12 000 DA par an après la fin de la période d'essai.</div>
             </div>

             <div className="bg-[#121214] border border-white/5 rounded-[32px] p-8 flex flex-col hover:border-purple-500/50 transition-all duration-500 hover:-translate-y-2">
                <h3 className="text-xl font-bold text-white mb-2">Équipe</h3>
                <div className="flex items-baseline gap-2 mb-6">
                   <span className="text-4xl font-black text-white">25 000 DA</span>
                   <span className="text-sm text-zinc-500 font-bold">/ par an</span>
                </div>
                <div className="w-full px-4 py-2 bg-black border border-white/10 rounded-xl text-xs font-medium text-white flex justify-between items-center mb-6">
                   Jusqu'à 5 utilisateurs <ChevronRight size={14}/>
                </div>
                <button className="w-full py-4 rounded-xl bg-white text-black font-black uppercase tracking-widest text-sm hover:scale-[1.02] transition-transform mb-8">Nous Contacter</button>
                <div className="space-y-4 text-sm text-zinc-400 font-medium flex-1">
                   <div className="flex items-start gap-3"><CheckCircle2 size={18} className="text-emerald-500 shrink-0"/> Toutes les fonctionnalités du plan Annuel</div>
                   <div className="flex items-start gap-3"><CheckCircle2 size={18} className="text-emerald-500 shrink-0"/> Gestion granulaire des permissions</div>
                   <div className="flex items-start gap-3"><CheckCircle2 size={18} className="text-emerald-500 shrink-0"/> Module HITL multi-collaborateurs</div>
                   <div className="flex items-start gap-3"><CheckCircle2 size={18} className="text-emerald-500 shrink-0"/> Déploiement on-premise possible</div>
                </div>
                <div className="mt-8 text-[11px] text-zinc-600 font-medium border-t border-white/5 pt-4">Facturé 25 000 DA par an. Aucun frais d'installation caché.</div>
             </div>
          </div>
        </div>
      </section>

      {/* Refined Footer CTA */}
      <section className="w-full py-32 border-t border-zinc-200 dark:border-white/10 relative overflow-hidden flex flex-col items-center justify-center text-center bg-zinc-50 dark:bg-transparent">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(99,102,241,0.10)_0,transparent_60%)]"></div>
        <h2 className="text-4xl md:text-5xl font-bold mb-6 relative z-10 tracking-tight text-zinc-900 dark:text-white">Prêt à automatiser vos données ?</h2>
        <p className="text-lg text-zinc-500 dark:text-zinc-400 mb-10 relative z-10 max-w-xl">Rejoignez des milliers d'ingénieurs qui construisent des fondations analytiques robustes avec l'IA.</p>
        <button onClick={onSelectSource} className="relative z-10 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[20px] font-semibold text-lg hover:scale-[1.02] transition-all flex items-center gap-3 group shadow-xl shadow-indigo-500/20">
          Commencer Dès Maintenant
          <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </section>

      <footer className="w-full border-t py-12 transition-colors duration-500 bg-white dark:bg-[#0A0A0B] border-zinc-200 dark:border-white/5 text-zinc-500 dark:text-zinc-400">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center gap-3 mb-6 md:mb-0">
             {/* 4. MODIFICATION ICI : Logo Antigravity supprimé */}
            <span className="text-sm font-semibold text-zinc-900 dark:text-white">Agent BI</span>
          </div>
          <div className="flex gap-8 text-sm font-medium">
            <a href="#" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Politique de Confidentialité</a>
            <a href="#" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Conditions d'Utilisation</a>
            <span>© 2026 Agent BI</span>
          </div>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{__html: `
        .shadow-glow { box-shadow: 0 0 25px rgba(99,102,241,0.5); }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}} />
    </div>
  );
}