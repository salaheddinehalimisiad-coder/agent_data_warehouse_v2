// src/components/AuthModal.jsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Loader2, Eye, EyeOff,
  Database, Sparkles, ArrowRight, ShieldCheck, Zap
} from 'lucide-react';
import { usePipelineStore } from '../store/pipelineStore';
import { apiClient } from '../api/client';

const FIELD_STYLE = {
  width: '100%', height: 42,
  background: 'var(--bg-higher)',
  border: '1px solid var(--border-default)',
  borderRadius: 8,
  padding: '0 14px',
  fontSize: 13, fontWeight: 400,
  color: 'var(--text-primary)',
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  fontFamily: 'inherit',
};

function Field({ label, children, hint }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>{hint}</p>}
    </div>
  );
}

export default function AuthModal({ isOpen, onClose, onSuccess }) {
  const { setAuth } = usePipelineStore();
  const [mode,     setMode]     = useState('register');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [prefix,   setPrefix]   = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const validate = () => {
    if (!email || !password) return 'Veuillez remplir tous les champs.';
    if (mode === 'register') {
      if (password.length < 8) return 'Mot de passe : 8 caractères minimum.';
      if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password))
        return 'Mot de passe : majuscule, minuscule et chiffre requis.';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);
    try {
      const data = mode === 'login'
        ? await apiClient.login(email, password)
        : await apiClient.register(email, password, prefix || 'dw');
      setAuth(data.token, data.user_id, data.prefix);
      onSuccess?.(); // FIX: Call onSuccess to redirect to dashboard
    } catch (err) {
      setError(err.message || "Erreur d'authentification.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'absolute', inset: 0, background: 'rgba(6,8,16,0.82)', backdropFilter: 'blur(12px)' }}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="card-premium"
            style={{
              position: 'relative', zIndex: 1,
              width: '100%', maxWidth: 860,
              display: 'flex', minHeight: 520, overflow: 'hidden',
            }}
          >
            {/* Left panel */}
            <div style={{
              width: '38%', flexShrink: 0,
              background: 'var(--bg-elevated)',
              borderRight: '1px solid var(--border-hair)',
              padding: '40px 32px',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              position: 'relative', overflow: 'hidden',
            }}>
              {/* Ambient glow */}
              <div style={{ position: 'absolute', top: -80, right: -80, width: 240, height: 240, borderRadius: '50%', background: 'var(--blue-600)', opacity: 0.07, filter: 'blur(80px)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: -60, left: -60, width: 200, height: 200, borderRadius: '50%', background: 'var(--purple-500)', opacity: 0.06, filter: 'blur(70px)', pointerEvents: 'none' }} />

              <div style={{ position: 'relative', zIndex: 1 }}>
                {/* Badge */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 99, background: 'rgba(61,106,232,0.12)', border: '1px solid rgba(61,106,232,0.22)', marginBottom: 20 }}>
                  <Database size={12} style={{ color: 'var(--blue-300)' }} />
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--blue-300)' }}>Agent Data Warehouse</span>
                </div>

                <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 10 }}>
                  {mode === 'register' ? 'Construisez votre\nData Warehouse.' : 'Bon retour\nparmi nous.'}
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 28 }}>
                  {mode === 'register'
                    ? "Rejoignez des ingénieurs data qui automatisent leur pipeline avec l'IA."
                    : 'Connectez-vous pour continuer à modéliser et orchestrer vos données.'}
                </p>

                {/* Features */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {[
                    { icon: Database, color: 'var(--blue-400)', title: 'Architecture IA', desc: 'Génération automatique de schémas en étoile optimisés.' },
                    { icon: Sparkles, color: 'var(--purple-400)', title: 'Auto-Correction', desc: 'Pipelines qui se réparent automatiquement en cas d\'échec.' },
                    { icon: ShieldCheck, color: 'var(--teal-400)', title: 'Qualité des données', desc: 'Monitoring et alertes DQ en temps réel.' },
                  ].map(({ icon: Icon, color, title, desc }) => (
                    <div key={title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--bg-higher)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={14} style={{ color }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Social proof */}
              <div style={{ position: 'relative', zIndex: 1, background: 'var(--bg-higher)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border-hair)', marginTop: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex' }}>
                    {[1,2,3].map(i => (
                      <div key={i} style={{ width: 26, height: 26, borderRadius: '50%', background: `hsl(${i*80+180},60%,55%)`, border: '2px solid var(--bg-higher)', marginLeft: i === 1 ? 0 : -8, fontSize: 11, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {String.fromCharCode(64 + i)}
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>Approuvé par les experts</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Communauté grandissante</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right panel — form */}
            <div style={{ flex: 1, padding: '40px 36px', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
              {/* Close */}
              <button
                onClick={onClose}
                style={{ position: 'absolute', top: 16, right: 16, width: 30, height: 30, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-higher)', border: '1px solid var(--border-soft)', cursor: 'pointer', color: 'var(--text-muted)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <X size={14} />
              </button>

              <div style={{ maxWidth: 320, margin: '0 auto', width: '100%' }}>
                {/* Tab toggle */}
                <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: 8, padding: 3, marginBottom: 28, border: '1px solid var(--border-hair)' }}>
                  {[{ id: 'register', label: "S'inscrire" }, { id: 'login', label: 'Se connecter' }].map(t => (
                    <button
                      key={t.id}
                      onClick={() => { setMode(t.id); setError(''); }}
                      style={{
                        flex: 1, padding: '7px 0', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        background: mode === t.id ? 'var(--bg-higher)' : 'transparent',
                        color: mode === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
                        border: mode === t.id ? '1px solid var(--border-soft)' : '1px solid transparent',
                        boxShadow: mode === t.id ? 'var(--shadow-sm)' : 'none',
                        transition: 'all 0.15s',
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Field label="Adresse e-mail">
                    <input
                      type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="vous@entreprise.com"
                      style={FIELD_STYLE}
                      onFocus={e => { e.target.style.borderColor = 'var(--blue-400)'; e.target.style.boxShadow = '0 0 0 3px rgba(61,106,232,0.12)'; }}
                      onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none'; }}
                    />
                  </Field>

                  <Field label="Mot de passe" hint={mode === 'register' ? 'Min. 8 caractères, avec majuscule, minuscule et chiffre.' : ''}>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        style={{ ...FIELD_STYLE, paddingRight: 40 }}
                        onFocus={e => { e.target.style.borderColor = 'var(--blue-400)'; e.target.style.boxShadow = '0 0 0 3px rgba(61,106,232,0.12)'; }}
                        onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none'; }}
                      />
                      <button
                        type="button" onClick={() => setShowPwd(!showPwd)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
                      >
                        {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </Field>

                  <AnimatePresence>
                    {mode === 'register' && (
                      <motion.div key="prefix" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                        <Field
                          label="Préfixe (optionnel)"
                          hint={`Tables générées : ${prefix || 'dw'}_fact_ventes`}
                        >
                          <input
                            type="text" value={prefix} onChange={e => setPrefix(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                            placeholder="ex: ventes, mktg"
                            style={FIELD_STYLE}
                            onFocus={e => { e.target.style.borderColor = 'var(--blue-400)'; e.target.style.boxShadow = '0 0 0 3px rgba(61,106,232,0.12)'; }}
                            onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none'; }}
                          />
                        </Field>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--red-400)', fontSize: 12, fontWeight: 500 }}
                      >
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    type="submit" disabled={loading}
                    style={{
                      width: '100%', height: 42, borderRadius: 8, cursor: loading ? 'default' : 'pointer',
                      background: loading ? 'var(--bg-higher)' : 'var(--grad-primary)',
                      color: '#fff', fontSize: 13, fontWeight: 600,
                      border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: loading ? 'none' : '0 2px 16px rgba(61,106,232,0.3)',
                      opacity: loading ? 0.7 : 1,
                      transition: 'opacity 0.15s, transform 0.1s',
                      marginTop: 4,
                    }}
                    onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.88'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = loading ? '0.7' : '1'; }}
                  >
                    {loading
                      ? <Loader2 size={16} className="animate-spin" />
                      : <>
                          {mode === 'login' ? 'Continuer' : "Créer l'espace de travail"}
                          <ArrowRight size={14} />
                        </>
                    }
                  </button>

                  {mode === 'register' && (
                    <p style={{ fontSize: 10, textAlign: 'center', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      En continuant, vous acceptez nos{' '}
                      <a href="#" style={{ color: 'var(--blue-300)', textDecoration: 'none' }}>Conditions d'Utilisation</a>
                      {' '}et notre{' '}
                      <a href="#" style={{ color: 'var(--blue-300)', textDecoration: 'none' }}>Politique de Confidentialité</a>.
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
