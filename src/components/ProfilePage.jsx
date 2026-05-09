// src/components/ProfilePage.jsx — Page profil professionnelle SaaS
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Camera, Check, Loader2, Trash2, User, Mail, Database,
  KeyRound, Eye, EyeOff, Shield, Calendar, Hash, Sparkles,
  Save, AlertTriangle, Bot
} from 'lucide-react';
import { apiClient } from '../api/client';
import { usePipelineStore } from '../store/pipelineStore';

const TAB_ITEMS = [
  { id: 'profile', label: 'Profil', icon: User },
  { id: 'security', label: 'Sécurité', icon: Shield },
  { id: 'activity', label: 'Activité', icon: Calendar },
];

export default function ProfilePage({ onBack }) {
  const { userPrefix } = usePipelineStore();
  const fileRef = useRef(null);

  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile]     = useState(null);
  const [fullName, setFullName]   = useState('');
  const [bio, setBio]             = useState('');
  const [prefix, setPrefix]       = useState('');
  const [avatarBust, setAvatarBust] = useState(Date.now());
  const [toast, setToast]         = useState(null);
  const [activeTab, setActiveTab] = useState('profile');

  // Password
  const [curPwd, setCurPwd]       = useState('');
  const [newPwd, setNewPwd]       = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const p = await apiClient.getProfile();
        if (!alive) return;
        setProfile(p);
        setFullName(p.full_name || '');
        setBio(p.bio || '');
        setPrefix(p.prefix || userPrefix || '');
      } catch (err) {
        setToast({ kind: 'error', text: err.message });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userPrefix]);

  const showToast = (kind, text) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3000);
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const patch = {};
      if (fullName !== (profile?.full_name || '')) patch.full_name = fullName;
      if (bio !== (profile?.bio || '')) patch.bio = bio;
      if (prefix !== (profile?.prefix || '')) patch.prefix = prefix;
      if (Object.keys(patch).length === 0) {
        showToast('info', 'Aucun changement à enregistrer');
        return;
      }
      const updated = await apiClient.updateProfile(patch);
      setProfile(updated);
      if (updated.prefix) localStorage.setItem('user_prefix', updated.prefix);
      showToast('success', 'Profil enregistré avec succès');
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const onAvatarPicked = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      showToast('error', 'Image trop lourde (max 3 Mo)');
      return;
    }
    setUploading(true);
    try {
      await apiClient.uploadAvatar(file);
      setAvatarBust(Date.now());
      setProfile(p => p ? { ...p, has_avatar: true } : p);
      showToast('success', 'Photo de profil mise à jour');
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeAvatar = async () => {
    try {
      const resp = await fetch('/api/auth/avatar', {
        method: 'DELETE',
        headers: apiClient.getHeaders(),
      });
      if (!resp.ok) throw new Error('Suppression impossible');
      setAvatarBust(Date.now());
      setProfile(p => p ? { ...p, has_avatar: false } : p);
      showToast('success', 'Photo supprimée');
    } catch (err) {
      showToast('error', err.message);
    }
  };

  const changePassword = async () => {
    if (!curPwd || !newPwd) {
      showToast('error', 'Remplissez les deux champs');
      return;
    }
    if (newPwd.length < 8 || !/[A-Z]/.test(newPwd) || !/[a-z]/.test(newPwd) || !/[0-9]/.test(newPwd)) {
      showToast('error', 'Min 8 caractères, majuscule, minuscule et chiffre');
      return;
    }
    setPwdSaving(true);
    try {
      await apiClient.changePassword(curPwd, newPwd);
      showToast('success', 'Mot de passe modifié');
      setCurPwd(''); setNewPwd('');
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setPwdSaving(false);
    }
  };

  const initials = (() => {
    const src = (profile?.full_name || profile?.email || 'U').trim();
    return src.split(/\s+|@/).map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  })();

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  return (
    <div className="absolute inset-0 overflow-y-auto" style={{ background: '#f8fafc', color: '#1e293b' }}>
      {/* Header banner — light gradient */}
      <div style={{ height: 200, background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 40%, #ddd6fe 100%)', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.4, background: 'radial-gradient(circle at 20% 80%, rgba(99,102,241,0.2) 0, transparent 50%), radial-gradient(circle at 80% 20%, rgba(139,92,246,0.15) 0, transparent 50%)' }} />
        <div className="max-w-5xl mx-auto px-6 h-full flex items-end pb-4 relative z-10">
          <button
            onClick={onBack}
            className="absolute top-5 left-6 flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft size={16} /> Retour
          </button>
          <h1 className="text-slate-800 text-lg font-semibold tracking-wide">Mon compte</h1>
        </div>
      </div>

      {/* Ambient glow orbs — light mode */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '10%', left: '15%', width: 400, height: 400, borderRadius: '50%', background: '#6366f1', opacity: 0.03, filter: 'blur(100px)' }} />
        <div style={{ position: 'absolute', bottom: '5%', right: '10%', width: 350, height: 350, borderRadius: '50%', background: '#a855f7', opacity: 0.025, filter: 'blur(90px)' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 300, height: 300, borderRadius: '50%', background: '#14b8a6', opacity: 0.02, filter: 'blur(80px)', transform: 'translate(-50%, -50%)' }} />
      </div>

      {/* Watermark — App logo centered */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 50, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ opacity: 0.04, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 420, height: 420, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 16px 64px rgba(99,102,241,0.1)' }}>
            <img src="/image-removebg-preview(21).png" alt="Agent BI" style={{ width: 400, height: 400, objectFit: 'contain', filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.06))' }} />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 pb-12 -mt-12 relative z-20">
        {loading ? (
          <div className="flex items-center justify-center py-24" style={{ color: '#64748b' }}>
            <Loader2 className="animate-spin mr-2" size={20} /> Chargement du profil…
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar */}
            <aside className="lg:w-80 flex-shrink-0">
              <div className="rounded-2xl border p-5 flex flex-col items-center text-center mb-4" style={{ background: '#ffffff', borderColor: '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div className="relative -mt-16 mb-3">
                  <div
                    className="w-24 h-24 rounded-full overflow-hidden border-4 flex items-center justify-center text-xl font-bold text-white shadow-lg"
                    style={{ borderColor: '#f8fafc', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                  >
                    {profile?.has_avatar ? (
                      <img src={apiClient.getAvatarUrl(profile.user_id, avatarBust)} alt="avatar" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </div>
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg transition-all border-2"
                    style={{ borderColor: '#f8fafc' }}
                    title="Changer la photo"
                  >
                    {uploading ? <Loader2 className="animate-spin" size={13} /> : <Camera size={13} />}
                  </button>
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onAvatarPicked} />
                </div>

                <h2 className="text-base font-bold tracking-tight break-words max-w-full">{profile?.full_name || profile?.email?.split('@')[0] || 'Utilisateur'}</h2>
                <p className="text-xs mt-1 flex items-center justify-center gap-1.5" style={{ color: '#64748b' }}>
                  <Mail size={11} /> {profile?.email}
                </p>

                {profile?.has_avatar && (
                  <button onClick={removeAvatar} className="mt-3 text-[11px] text-red-400 hover:text-red-300 inline-flex items-center gap-1 transition-colors">
                    <Trash2 size={10} /> Supprimer la photo
                  </button>
                )}
              </div>

              {/* Tabs */}
              <div className="rounded-2xl border p-1.5 space-y-0.5" style={{ background: '#ffffff', borderColor: '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                {TAB_ITEMS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                    style={{
                      background: activeTab === id ? 'rgba(61,106,232,0.08)' : 'transparent',
                      color: activeTab === id ? '#4f46e5' : '#64748b',
                      border: activeTab === id ? '1px solid rgba(61,106,232,0.18)' : '1px solid transparent',
                    }}
                  >
                    <Icon size={15} /> {label}
                  </button>
                ))}
              </div>

              {/* Meta card */}
              <div className="rounded-2xl border p-4 mt-4 text-xs space-y-2.5" style={{ background: '#ffffff', borderColor: '#e2e8f0', color: '#64748b', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Hash size={11} /> ID</span>
                  <span className="font-mono font-medium" style={{ color: '#1e293b' }}>{profile?.user_id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Calendar size={11} /> Membre depuis</span>
                  <span className="font-medium" style={{ color: '#1e293b' }}>{memberSince}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Sparkles size={11} /> Dernière connexion</span>
                  <span className="font-medium" style={{ color: '#1e293b' }}>
                    {profile?.last_login_at ? new Date(profile.last_login_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                </div>
              </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 min-w-0">
              <AnimatePresence mode="wait">
                {activeTab === 'profile' && (
                  <motion.div key="profile" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                    <div className="rounded-2xl border p-6 space-y-6" style={{ background: '#ffffff', borderColor: '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-widest mb-5" style={{ color: '#94a3b8' }}>Informations personnelles</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div>
                            <label className="text-xs font-semibold mb-2 block flex items-center gap-1.5" style={{ color: '#475569' }}>
                              <User size={12} /> Nom complet
                            </label>
                            <input
                              value={fullName}
                              onChange={e => setFullName(e.target.value)}
                              placeholder="Votre nom"
                              className="w-full h-12 border rounded-xl px-4 text-sm font-medium outline-none transition-all focus:ring-2"
                              style={{
                                background: '#f8fafc', borderColor: '#cbd5e1', color: '#1e293b',
                              }}
                              onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }}
                              onBlur={e => { e.target.style.borderColor = '#cbd5e1'; e.target.style.boxShadow = 'none'; }}
                            />
                          </div>

                          <div>
                            <label className="text-xs font-semibold mb-2 block flex items-center gap-1.5" style={{ color: '#475569' }}>
                              <Mail size={12} /> Adresse e-mail
                            </label>
                            <input
                              value={profile?.email || ''}
                              disabled
                              className="w-full h-12 border rounded-xl px-4 text-sm font-medium opacity-60 cursor-not-allowed"
                              style={{ background: '#f8fafc', borderColor: '#cbd5e1', color: '#1e293b' }}
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="text-xs font-semibold mb-2 block flex items-center gap-1.5" style={{ color: '#475569' }}>
                              <Database size={12} /> Préfixe d'espace de travail
                            </label>
                            <input
                              value={prefix}
                              onChange={e => setPrefix(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                              placeholder="ex: ventes"
                              className="w-full h-12 border rounded-xl px-4 font-mono text-sm font-medium outline-none transition-all"
                              style={{
                                background: '#f8fafc', borderColor: '#cbd5e1', color: '#1e293b',
                              }}
                              onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }}
                              onBlur={e => { e.target.style.borderColor = '#cbd5e1'; e.target.style.boxShadow = 'none'; }}
                            />
                            <p className="text-[11px] mt-1.5" style={{ color: '#64748b' }}>
                              Ex. <span className="font-mono px-1 rounded" style={{ background: '#f1f5f9' }}>{prefix || 'dw'}_fact_ventes</span>. Caractères autorisés : [a-z0-9_]
                            </p>
                          </div>

                          <div className="md:col-span-2">
                            <label className="text-xs font-semibold mb-2 block" style={{ color: '#475569' }}>Bio</label>
                            <textarea
                              value={bio}
                              onChange={e => setBio(e.target.value.slice(0, 500))}
                              rows={5}
                              placeholder="Quelques mots sur vous…"
                              className="w-full border rounded-xl px-4 py-3 text-sm font-medium outline-none transition-all resize-none"
                              style={{
                                background: '#f8fafc', borderColor: '#cbd5e1', color: '#1e293b',
                              }}
                              onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }}
                              onBlur={e => { e.target.style.borderColor = '#cbd5e1'; e.target.style.boxShadow = 'none'; }}
                            />
                            <p className="text-[11px] mt-1.5 text-right" style={{ color: '#64748b' }}>{bio.length}/500</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-2 border-t" style={{ borderColor: '#e2e8f0' }}>
                        <button
                          onClick={saveProfile}
                          disabled={saving}
                          className="inline-flex items-center gap-2 px-6 h-10 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-50"
                          style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 2px 12px rgba(61,106,232,0.3)' }}
                          onMouseEnter={e => { if (!saving) e.currentTarget.style.opacity = '0.88'; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                        >
                          {saving ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}
                          Enregistrer les modifications
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'security' && (
                  <motion.div key="security" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                    <div className="rounded-2xl border p-6 space-y-6" style={{ background: '#ffffff', borderColor: '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-widest mb-1" style={{ color: '#64748b' }}>Mot de passe</h3>
                        <p className="text-xs mb-5" style={{ color: '#475569' }}>Modifiez votre mot de passe pour sécuriser votre compte.</p>

                        <div className="space-y-4 max-w-md">
                          <div>
                            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#475569' }}>Mot de passe actuel</label>
                            <div className="relative">
                              <input
                                type={showPwd ? 'text' : 'password'}
                                value={curPwd}
                                onChange={e => setCurPwd(e.target.value)}
                                placeholder="••••••••"
                                className="w-full h-12 border rounded-xl px-4 pr-11 text-sm outline-none transition-all"
                                style={{ background: '#f8fafc', borderColor: '#cbd5e1', color: '#1e293b' }}
                                onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(61,106,232,0.1)'; }}
                                onBlur={e => { e.target.style.borderColor = '#cbd5e1'; e.target.style.boxShadow = 'none'; }}
                              />
                              <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors" style={{ color: '#64748b' }}>
                                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#475569' }}>Nouveau mot de passe</label>
                            <input
                              type={showPwd ? 'text' : 'password'}
                              value={newPwd}
                              onChange={e => setNewPwd(e.target.value)}
                              placeholder="••••••••"
                              className="w-full h-12 border rounded-xl px-4 text-sm outline-none transition-all"
                              style={{ background: '#f8fafc', borderColor: '#cbd5e1', color: '#1e293b' }}
                              onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(61,106,232,0.1)'; }}
                              onBlur={e => { e.target.style.borderColor = '#cbd5e1'; e.target.style.boxShadow = 'none'; }}
                            />
                            <p className="text-[11px] mt-1.5" style={{ color: '#64748b' }}>Minimum 8 caractères, 1 majuscule, 1 minuscule et 1 chiffre.</p>
                          </div>

                          {/* Password checklist */}
                          <div className="flex flex-wrap gap-2">
                            {[
                              { label: '8 caractères', valid: newPwd.length >= 8 },
                              { label: 'Majuscule', valid: /[A-Z]/.test(newPwd) },
                              { label: 'Minuscule', valid: /[a-z]/.test(newPwd) },
                              { label: 'Chiffre', valid: /[0-9]/.test(newPwd) },
                            ].map((req, i) => (
                              <span key={i} className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md border transition-all"
                                style={{
                                  color: req.valid ? '#22c55e' : '#64748b',
                                  borderColor: req.valid ? 'rgba(34,197,94,0.3)' : '#cbd5e1',
                                  background: req.valid ? 'rgba(34,197,94,0.06)' : '#f8fafc',
                                }}
                              >
                                {req.valid ? <Check size={10} /> : <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#64748b' }} />}
                                {req.label}
                              </span>
                            ))}
                          </div>

                          <div className="pt-2">
                            <button
                              onClick={changePassword}
                              disabled={pwdSaving}
                              className="inline-flex items-center gap-2 px-6 h-10 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-50"
                              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 2px 12px rgba(61,106,232,0.3)' }}
                            >
                              {pwdSaving ? <Loader2 className="animate-spin" size={14} /> : <KeyRound size={14} />}
                              Mettre à jour le mot de passe
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="border-t pt-6" style={{ borderColor: '#e2e8f0' }}>
                        <h3 className="text-sm font-bold uppercase tracking-widest mb-1 flex items-center gap-2" style={{ color: '#ef4444' }}>
                          <AlertTriangle size={14} /> Zone de danger
                        </h3>
                        <p className="text-xs mb-4" style={{ color: '#475569' }}>Ces actions sont irréversibles.</p>
                        <div className="flex items-center justify-between p-4 rounded-xl border" style={{ background: '#f8fafc', borderColor: '#cbd5e1' }}>
                          <div>
                            <div className="text-sm font-semibold" style={{ color: '#1e293b' }}>Supprimer le compte</div>
                            <div className="text-[11px]" style={{ color: '#64748b' }}>Cette action est définitive et supprime toutes vos données.</div>
                          </div>
                          <button className="text-xs font-semibold px-4 h-9 rounded-lg border transition-colors" style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>
                            Supprimer
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'activity' && (
                  <motion.div key="activity" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                    <div className="rounded-2xl border p-6" style={{ background: '#ffffff', borderColor: '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <h3 className="text-sm font-bold uppercase tracking-widest mb-5" style={{ color: '#64748b' }}>Historique de connexion</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 rounded-xl border" style={{ background: '#f8fafc', borderColor: '#cbd5e1' }}>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(61,106,232,0.1)' }}>
                              <Shield size={15} style={{ color: '#6366f1' }} />
                            </div>
                            <div>
                              <div className="text-sm font-semibold" style={{ color: '#1e293b' }}>Connexion réussie</div>
                              <div className="text-[11px]" style={{ color: '#64748b' }}>Web · {profile?.last_login_at ? new Date(profile.last_login_at).toLocaleString('fr-FR') : '—'}</div>
                            </div>
                          </div>
                          <span className="text-[11px] font-medium px-2 py-1 rounded-md" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>Actuel</span>
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-xl border" style={{ background: '#f8fafc', borderColor: '#cbd5e1' }}>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.1)' }}>
                              <User size={15} style={{ color: '#818cf8' }} />
                            </div>
                            <div>
                              <div className="text-sm font-semibold" style={{ color: '#1e293b' }}>Compte créé</div>
                              <div className="text-[11px]" style={{ color: '#64748b' }}>{memberSince}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </main>
          </div>
        )}
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[400] px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold ${
              toast.kind === 'success' ? 'bg-emerald-600 text-white' :
              toast.kind === 'error'   ? 'bg-red-600 text-white'   :
                                         'bg-zinc-800 text-white'
            }`}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
