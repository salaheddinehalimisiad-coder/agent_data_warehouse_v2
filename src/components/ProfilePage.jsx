// src/components/ProfilePage.jsx — Profil utilisateur (éditer compte + avatar)
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Camera, Check, Loader2, Trash2, User, Mail, Database,
  KeyRound, Eye, EyeOff,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { usePipelineStore } from '../store/pipelineStore';

export default function ProfilePage({ onBack }) {
  const { userPrefix } = usePipelineStore();
  const fileRef = useRef(null);

  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile]   = useState(null);
  const [fullName, setFullName] = useState('');
  const [bio, setBio]           = useState('');
  const [prefix, setPrefix]     = useState('');
  const [avatarBust, setAvatarBust] = useState(Date.now());
  const [toast, setToast]       = useState(null);

  // Password change panel
  const [showPwdPanel, setShowPwdPanel] = useState(false);
  const [curPwd, setCurPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
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
    setTimeout(() => setToast(null), 2800);
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const patch = {};
      if (fullName !== (profile?.full_name || '')) patch.full_name = fullName;
      if (bio      !== (profile?.bio       || '')) patch.bio       = bio;
      if (prefix   !== (profile?.prefix    || '')) patch.prefix    = prefix;
      if (Object.keys(patch).length === 0) {
        showToast('info', 'Aucun changement à enregistrer');
        return;
      }
      const updated = await apiClient.updateProfile(patch);
      setProfile(updated);
      if (updated.prefix) localStorage.setItem('user_prefix', updated.prefix);
      showToast('success', 'Profil mis à jour');
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
      showToast('error', 'Avatar trop lourd (max 3 Mo)');
      return;
    }
    setUploading(true);
    try {
      await apiClient.uploadAvatar(file);
      setAvatarBust(Date.now());
      setProfile((p) => (p ? { ...p, has_avatar: true } : p));
      showToast('success', 'Avatar mis à jour');
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
      setProfile((p) => (p ? { ...p, has_avatar: false } : p));
      showToast('success', 'Avatar supprimé');
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
      showToast('error', 'Min 8 car. avec maj, min et chiffre');
      return;
    }
    setPwdSaving(true);
    try {
      await apiClient.changePassword(curPwd, newPwd);
      showToast('success', 'Mot de passe changé');
      setCurPwd(''); setNewPwd(''); setShowPwdPanel(false);
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setPwdSaving(false);
    }
  };

  const initials = (() => {
    const src = (profile?.full_name || profile?.email || 'User').trim();
    return src.split(/\s+|@/).map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  })();

  return (
    <div className="absolute inset-0 overflow-y-auto" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-10">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} /> Retour
          </button>
          <div className="text-xs uppercase tracking-widest text-slate-500">Mon compte</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-500">
            <Loader2 className="animate-spin mr-2" size={18} /> Chargement du profil…
          </div>
        ) : (
          <>
            {/* Avatar + identity */}
            <div className="rounded-3xl border p-6 mb-6 flex items-center gap-6" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-elevated)' }}>
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 flex items-center justify-center text-2xl font-bold bg-gradient-to-br from-indigo-500 to-purple-600 text-white" style={{ borderColor: 'var(--border-default)' }}>
                  {profile?.has_avatar ? (
                    <img
                      src={apiClient.getAvatarUrl(profile.user_id, avatarBust)}
                      alt="avatar"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                <button
                  onClick={() => fileRef.current?.click()}
                  title="Changer l'avatar"
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg transition-all"
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="animate-spin" size={14} /> : <Camera size={14} />}
                </button>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={onAvatarPicked} />
              </div>

              <div className="flex-1">
                <h1 className="text-2xl font-bold tracking-tight">{profile?.full_name || profile?.email?.split('@')[0] || 'Utilisateur'}</h1>
                <p className="text-sm text-slate-400 flex items-center gap-2 mt-1"><Mail size={13} /> {profile?.email}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Membre depuis {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('fr-FR') : '—'}
                </p>
                {profile?.has_avatar && (
                  <button onClick={removeAvatar} className="mt-3 text-xs text-red-400 hover:text-red-300 inline-flex items-center gap-1">
                    <Trash2 size={12} /> Supprimer l'avatar
                  </button>
                )}
              </div>
            </div>

            {/* Fields */}
            <div className="rounded-3xl border p-6 mb-6 space-y-5" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-elevated)' }}>
              <h2 className="text-sm uppercase tracking-widest text-slate-500 font-bold">Informations</h2>

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block flex items-center gap-1.5"><User size={12}/> Nom complet</label>
                <input
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Ex. Salah Eddine Halimi"
                  className="w-full h-11 bg-zinc-900/60 border border-white/10 rounded-xl px-4 text-sm font-medium text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-zinc-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block flex items-center gap-1.5"><Database size={12}/> Préfixe d'espace de travail</label>
                <input
                  value={prefix}
                  onChange={e => setPrefix(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="dw_ventes"
                  className="w-full h-11 bg-zinc-900/60 border border-white/10 rounded-xl px-4 font-mono text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-zinc-500"
                />
                <p className="text-[11px] text-zinc-500 mt-1.5">Ex. <span className="font-mono bg-zinc-800 px-1 rounded">{prefix || 'dw'}_fact_ventes</span>. Seulement [a-z0-9_].</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Bio (optionnel)</label>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value.slice(0, 500))}
                  rows={3}
                  placeholder="Quelques mots sur vous…"
                  className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-zinc-500 resize-none"
                />
                <p className="text-[11px] text-zinc-500 mt-1.5 text-right">{bio.length}/500</p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />}
                  Enregistrer
                </button>
              </div>
            </div>

            {/* Password */}
            <div className="rounded-3xl border p-6 mb-6" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-elevated)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm uppercase tracking-widest text-slate-500 font-bold flex items-center gap-2"><KeyRound size={14}/> Mot de passe</h2>
                  <p className="text-xs text-slate-500 mt-1">Modifiez votre mot de passe à tout moment.</p>
                </div>
                <button
                  onClick={() => setShowPwdPanel(v => !v)}
                  className="text-xs font-semibold text-indigo-300 hover:text-indigo-200"
                >
                  {showPwdPanel ? 'Annuler' : 'Modifier'}
                </button>
              </div>

              {showPwdPanel && (
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 mb-1 block">Mot de passe actuel</label>
                    <div className="relative">
                      <input
                        type={showPwd ? 'text' : 'password'}
                        value={curPwd}
                        onChange={e => setCurPwd(e.target.value)}
                        className="w-full h-10 bg-zinc-900/60 border border-white/10 rounded-xl px-4 pr-11 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                      <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200">
                        {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 mb-1 block">Nouveau mot de passe</label>
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={newPwd}
                      onChange={e => setNewPwd(e.target.value)}
                      className="w-full h-10 bg-zinc-900/60 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                    <p className="text-[11px] text-zinc-500 mt-1">Min 8 caractères, 1 majuscule, 1 minuscule, 1 chiffre.</p>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={changePassword}
                      disabled={pwdSaving}
                      className="inline-flex items-center gap-2 px-5 h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm disabled:opacity-50"
                    >
                      {pwdSaving ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                      Changer
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Danger / account meta */}
            <div className="rounded-3xl border p-6 text-xs text-slate-500" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-elevated)' }}>
              <div className="flex justify-between">
                <span>ID utilisateur</span>
                <span className="font-mono text-slate-300">{profile?.user_id}</span>
              </div>
              <div className="flex justify-between mt-1.5">
                <span>Dernière connexion</span>
                <span className="text-slate-300">{profile?.last_login_at ? new Date(profile.last_login_at).toLocaleString('fr-FR') : '—'}</span>
              </div>
            </div>
          </>
        )}

        {/* Toast */}
        {toast && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[400] px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold ${
              toast.kind === 'success' ? 'bg-emerald-600 text-white' :
              toast.kind === 'error'   ? 'bg-red-600 text-white'   :
                                         'bg-zinc-800 text-white'
            }`}
          >
            {toast.text}
          </motion.div>
        )}
      </div>
    </div>
  );
}
