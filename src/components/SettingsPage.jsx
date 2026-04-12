// src/components/SettingsPage.jsx — Page de configuration complète
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings, Server, Mail, Database,
  Check, X, Loader2, Eye, EyeOff,
  Cpu, RefreshCw, Save,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function Section({ title, icon: Icon, children }) {
  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 bg-zinc-900/60 border-b border-zinc-800">
        <Icon size={14} className="text-indigo-400" />
        <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder = '', hint = '' }) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <div>
      <label className="block text-[11px] text-zinc-500 mb-1.5 font-medium">{label}</label>
      <div className="relative">
        <input
          type={isPassword && !show ? 'password' : 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200
            focus:outline-none focus:border-indigo-500/50 transition-colors
            placeholder:text-zinc-600 pr-9"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            {show ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        )}
      </div>
      {hint && <p className="text-[10px] text-zinc-600 mt-1">{hint}</p>}
    </div>
  );
}

function StatusDot({ ok, label }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${ok === true ? 'bg-emerald-400' : ok === false ? 'bg-rose-400' : 'bg-zinc-600'}`} />
      <span className={`text-[11px] font-mono ${ok === true ? 'text-emerald-400' : ok === false ? 'text-rose-400' : 'text-zinc-500'}`}>
        {label}
      </span>
    </div>
  );
}

export default function SettingsPage({ onClose }) {
  // Ollama settings
  const [ollamaUrl,   setOllamaUrl]   = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('qwen2.5-coder:7b');
  const [ollamaStatus, setOllamaStatus] = useState(null); // null | true | false

  // Gemini
  const [geminiKey, setGeminiKey] = useState('');

  // SMTP
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');

  // Enregistrement
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [testing,  setTesting]  = useState(false);

  // Charger les settings sauvegardés localement
  useEffect(() => {
    const saved = localStorage.getItem('adw_settings');
    if (saved) {
      const s = JSON.parse(saved);
      if (s.ollamaUrl)   setOllamaUrl(s.ollamaUrl);
      if (s.ollamaModel) setOllamaModel(s.ollamaModel);
      if (s.smtpHost)    setSmtpHost(s.smtpHost);
      if (s.smtpPort)    setSmtpPort(s.smtpPort);
      if (s.smtpUser)    setSmtpUser(s.smtpUser);
    }
  }, []);

  const handleTestOllama = async () => {
    setTesting(true);
    try {
      const resp = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
      setOllamaStatus(resp.ok);
    } catch {
      setOllamaStatus(false);
    } finally {
      setTesting(false);
    }
  };

  const handleTestBackend = async () => {
    try {
      const resp = await fetch(`${API_BASE}/health`);
      return resp.ok;
    } catch {
      return false;
    }
  };

  const handleSave = () => {
    setSaving(true);
    const settings = { ollamaUrl, ollamaModel, smtpHost, smtpPort, smtpUser };
    localStorage.setItem('adw_settings', JSON.stringify(settings));
    setTimeout(() => { setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000); }, 500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose?.()}
    >
      <div className="bg-[#09090b] border border-zinc-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#0c0c0e] shrink-0">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-indigo-400" />
            <h2 className="text-sm font-bold text-white">Paramètres</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Ollama */}
          <Section title="Modèle LLM — Ollama" icon={Cpu}>
            <Field label="URL Ollama" value={ollamaUrl} onChange={setOllamaUrl}
              placeholder="http://localhost:11434"
              hint="URL de votre instance Ollama locale" />
            <Field label="Modèle par défaut" value={ollamaModel} onChange={setOllamaModel}
              placeholder="qwen2.5-coder:7b"
              hint="Ex: qwen2.5-coder:7b | mistral:latest | codellama:latest" />

            <div className="flex items-center justify-between">
              <StatusDot
                ok={ollamaStatus}
                label={ollamaStatus === null ? 'Non testé' : ollamaStatus ? 'Ollama disponible' : 'Ollama inaccessible'}
              />
              <button
                onClick={handleTestOllama}
                disabled={testing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 rounded-lg transition-all disabled:opacity-50"
              >
                {testing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                Tester la connexion
              </button>
            </div>
          </Section>

          {/* Gemini */}
          <Section title="Google Gemini (fallback)" icon={Server}>
            <Field label="Clé API Gemini" value={geminiKey} onChange={setGeminiKey}
              type="password" placeholder="AIza..."
              hint="Utilisé si Ollama est inaccessible. Obtenez une clé sur aistudio.google.com" />
          </Section>

          {/* SMTP */}
          <Section title="Notifications Email (SMTP)" icon={Mail}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Serveur SMTP" value={smtpHost} onChange={setSmtpHost} placeholder="smtp.gmail.com" />
              <Field label="Port" value={smtpPort} onChange={setSmtpPort} placeholder="587" />
            </div>
            <Field label="Email expéditeur" value={smtpUser} onChange={setSmtpUser}
              placeholder="votre@gmail.com" type="email" />
            <Field label="Mot de passe d'application" value={smtpPass} onChange={setSmtpPass}
              type="password" placeholder="xxxx xxxx xxxx xxxx"
              hint="Pour Gmail : Compte Google → Sécurité → Mots de passe d'application" />
            <div className="text-[10px] text-zinc-600 bg-zinc-800/50 border border-zinc-800 rounded-lg px-3 py-2">
              ⚠️ Ces paramètres sont appliqués côté serveur via le fichier .env.
              Redémarrez le backend après modification.
            </div>
          </Section>

          {/* Info backend */}
          <Section title="Connexion Backend" icon={Database}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-400 font-mono">{API_BASE}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">Défini via VITE_API_URL dans .env</p>
              </div>
              <button
                onClick={async () => {
                  const ok = await handleTestBackend();
                  setOllamaStatus(ok ? true : false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 rounded-lg transition-all"
              >
                <RefreshCw size={11} /> Tester
              </button>
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-[#0c0c0e] flex items-center justify-between shrink-0">
          <p className="text-[10px] text-zinc-600">
            Les paramètres sensibles (mots de passe) sont stockés dans .env côté serveur
          </p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={13} className="animate-spin" />
              : saved  ? <Check size={13} className="text-emerald-300" />
              : <Save size={13} />}
            {saved ? 'Sauvegardé !' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
