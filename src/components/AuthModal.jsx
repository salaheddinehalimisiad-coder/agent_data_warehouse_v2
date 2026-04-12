// src/components/AuthModal.jsx — Neural ID Interface (V3 Premium)
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Loader2, Eye, EyeOff, 
  Database, Sparkles, ArrowRight,
  Blocks
} from 'lucide-react';
import { usePipelineStore } from '../store/pipelineStore';
import { apiClient } from '../api/client';

export default function AuthModal({ isOpen, onClose }) {
  const { setAuth } = usePipelineStore();
  const [mode, setMode] = useState('register'); // Default to register for onboarding feel
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [prefix, setPrefix] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { 
      setError('Veuillez remplir tous les champs obligatoires.'); 
      return; 
    }

    setLoading(true);
    try {
      const data = mode === 'login'
        ? await apiClient.login(email, password)
        : await apiClient.register(email, password, prefix || 'dw');
      setAuth(data.token, data.user_id, data.prefix);
      onClose();
    } catch (err) {
      setError(err.message || "Une erreur s'est produite lors de l'authentification.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-6">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-900/40 backdrop-blur-md"
            style={{ zIndex: 0 }}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="relative z-10 w-full max-w-[900px] bg-white dark:bg-[#0A0A0B] rounded-[32px] overflow-hidden shadow-2xl border border-zinc-200 dark:border-white/10 flex flex-col md:flex-row min-h-[550px]"
          >
            {/* Left Panel: Value Proposition / Onboarding UX */}
            <div className="hidden md:flex flex-col justify-between w-[40%] bg-zinc-50 dark:bg-zinc-900/50 p-10 border-r border-zinc-200 dark:border-white/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
              
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 shadow-sm mb-6">
                  <Database size={14} className="text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Configuration Agentic DW</span>
                </div>
                
                <h2 className="text-3xl font-bold text-zinc-900 dark:text-white leading-tight mb-4 tracking-tight">
                  {mode === 'register' ? "Construisez votre Data Warehouse." : "Bon retour parmi nous."}
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed mb-10 font-medium">
                  {mode === 'register' 
                    ? "Rejoignez des milliers d'ingénieurs data automatisant leur pipeline avec l'IA." 
                    : "Connectez-vous pour continuer à modéliser et orchestrer vos données."}
                </p>

                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Blocks size={14} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1">Architecture pilotée par l'IA</h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">Génération automatique de tables de faits et de dimensions optimisées pour l'analytique.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles size={14} className="text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1">Auto-Correction Autonome</h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">Des pipelines qui s'auto-corrigent en cas d'échec, assurant 99,9 % de disponibilité des données.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative z-10 flex items-center gap-3 bg-white dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm mt-8">
                <div className="flex -space-x-2 shrink-0">
                   {[
                     'https://i.pravatar.cc/100?img=1',
                     'https://i.pravatar.cc/100?img=2',
                     'https://i.pravatar.cc/100?img=3'
                   ].map((src, i) => (
                     <img key={i} src={src} alt="user" className="w-8 h-8 rounded-full border-2 border-white dark:border-zinc-800 object-cover" />
                   ))}
                </div>
                <div className="text-xs">
                  <span className="font-bold text-zinc-900 dark:text-white block">Approuvé par les experts</span>
                  <span className="text-zinc-500 dark:text-zinc-400">Rejoignez une communauté grandissante</span>
                </div>
              </div>
            </div>

            {/* Right Panel: Clean Interactive Form */}
            <div className="flex-1 p-8 md:p-12 flex flex-col relative bg-white dark:bg-[#0A0A0B]">
              <button onClick={onClose} className="absolute top-6 right-6 p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 rounded-full transition-all">
                <X size={18} />
              </button>

              <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
                {/* Onboarding Mode Toggle */}
                <div className="flex bg-zinc-100 dark:bg-zinc-900/80 p-1 rounded-xl mb-10 w-fit mx-auto border border-zinc-200 dark:border-white/5">
                  <button 
                    type="button"
                    onClick={() => { setMode('register'); setError(''); }} 
                    className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${mode === 'register' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                  >
                    S'inscrire
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setMode('login'); setError(''); }} 
                    className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${mode === 'login' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                  >
                    Se connecter
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 ml-1 mb-1.5 block">Adresse E-mail</label>
                    <input 
                      type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="vous@entreprise.com"
                      className="w-full h-12 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 rounded-xl px-4 text-sm font-medium text-zinc-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-zinc-400"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 ml-1 mb-1.5 block">Mot de passe</label>
                    <div className="relative">
                      <input 
                        type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full h-12 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 rounded-xl px-4 pr-12 text-sm font-medium text-zinc-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-zinc-400"
                      />
                      <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                         {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {mode === 'register' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 ml-1 mb-1.5 block">Préfixe de l'espace de travail (Optionnel)</label>
                      <input 
                         type="text" value={prefix} onChange={e => setPrefix(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                         placeholder="ex: ventes, mktg"
                         className="w-full h-12 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 rounded-xl px-4 text-sm font-medium text-zinc-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-zinc-400"
                      />
                      <p className="text-[11px] text-zinc-500 mt-2 ml-1">
                        Préfixe pour vos tables générées (ex. <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded">{prefix || 'dw'}_fact_ventes</span>)
                      </p>
                    </motion.div>
                  )}

                  <AnimatePresence>
                    {error && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold">
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button 
                    type="submit" disabled={loading}
                    className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 mt-4"
                  >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : (mode === 'login' ? 'Continuer' : 'Créer l\'espace de travail')}
                    {!loading && <ArrowRight size={16} />}
                  </button>
                  
                  {mode === 'register' && (
                    <p className="text-[11px] text-center text-zinc-500 font-medium pt-2">
                      En continuant, vous acceptez nos <a href="#" className="text-indigo-600 dark:text-indigo-400 hover:underline">Conditions d'Utilisation</a> et notre <a href="#" className="text-indigo-600 dark:text-indigo-400 hover:underline">Politique de Confidentialité</a>.
                    </p>
                  )}
                </form>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
