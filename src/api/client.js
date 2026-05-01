// src/api/client.js — Couche d'abstraction API complète production
const API_BASE = import.meta.env.MODE === 'production' ? (import.meta.env.VITE_API_URL || '') : '';

/**
 * Déclenche une déconnexion propre si le backend renvoie 401 sur une route
 * authentifiée. Évite la boucle infinie d'EventSource avec un token expiré.
 * Diffuse `auth:unauthorized` capté par App.jsx pour rediriger vers le login.
 */
function handleUnauthorized() {
  try {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_prefix');
  } catch { /* noop */ }
  try {
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
  } catch { /* noop */ }
}

/**
 * Transforme un payload d'erreur FastAPI/Pydantic en message lisible FR.
 * - detail === string  → utilisé tel quel
 * - detail === array   → concat des `.msg` (Pydantic ValidationError)
 * - detail === object  → fallback sur JSON
 */
function formatErrorPayload(payload, fallback = 'Une erreur est survenue') {
  if (!payload) return fallback;
  const d = payload.detail ?? payload.message ?? payload.error ?? payload;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) {
    const parts = d.map((item) => {
      if (!item) return '';
      if (typeof item === 'string') return item;
      const loc = Array.isArray(item.loc) ? item.loc.filter((x) => x !== 'body').join('.') : '';
      const msg = item.msg || item.message || '';
      // Pydantic prefixes messages with "Value error, " — on retire.
      const cleaned = String(msg).replace(/^Value error,\s*/i, '');
      return loc ? `${loc} : ${cleaned}` : cleaned;
    }).filter(Boolean);
    return parts.join(' · ') || fallback;
  }
  if (typeof d === 'object') {
    if (d.msg) return String(d.msg);
    try { return JSON.stringify(d); } catch { return fallback; }
  }
  return String(d);
}

export const apiClient = {
  getHeaders(isFormData = false) {
    const token = localStorage.getItem('auth_token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!isFormData) headers['Content-Type'] = 'application/json';
    return headers;
  },

  async startPipeline(req) {
    const resp = await fetch(`${API_BASE}/api/start`, {
      method: 'POST', headers: this.getHeaders(),
      body: JSON.stringify(req),
    });
    if (!resp.ok) throw new Error(`Erreur démarrage pipeline : ${resp.status}`);
    return resp.json();
  },

  async validatePipeline(req) {
    const resp = await fetch(`${API_BASE}/api/validate`, {
      method: 'POST', headers: this.getHeaders(),
      body: JSON.stringify(req),
    });
    if (!resp.ok) throw new Error(`Erreur validation : ${resp.status}`);
    return resp.json();
  },

  async sendChat(req) {
    const resp = await fetch(`${API_BASE}/api/chat?session_id=${req.session_id}`, {
      method: 'POST', headers: this.getHeaders(),
      body: JSON.stringify({ message: req.message, context: req.context || 'sql' }),
    });
    if (!resp.ok) throw new Error(`Erreur chat : ${resp.status}`);
    return resp.json();
  },

  /**
   * Stream version du chat. Appelle onDelta(chunk) au fil des tokens, et
   * onDone(meta) quand la reponse est complete.
   * Retourne une fonction d'annulation.
   */
  async sendChatStream(req, { onStart, onDelta, onDone, onError }) {
    const ctrl = new AbortController();
    try {
      const resp = await fetch(`${API_BASE}/api/chat/stream?session_id=${req.session_id}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ message: req.message, context: req.context || 'sql' }),
        signal: ctrl.signal,
      });
      if (!resp.ok) {
        const t = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status} ${t.substring(0, 200)}`);
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) !== -1) {
          const block = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const line = block.split('\n').find(l => l.startsWith('data:'));
          if (!line) continue;
          let payload;
          try { payload = JSON.parse(line.slice(5).trim()); } catch { continue; }
          if (payload.type === 'start' && onStart) onStart(payload);
          else if (payload.type === 'delta' && onDelta) onDelta(payload.content || '');
          else if (payload.type === 'done' && onDone) onDone(payload);
          else if (payload.type === 'error' && onError) onError(new Error(payload.error || 'stream error'));
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError' && onError) onError(e);
    }
    return () => ctrl.abort();
  },

  async executeQuery(sessionId, question) {
    const resp = await fetch(`${API_BASE}/api/query`, {
      method: 'POST', headers: this.getHeaders(),
      body: JSON.stringify({ session_id: sessionId, question }),
    });
    if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e.detail || `Erreur d'exécution de la requête : ${resp.status}`);
    }
    return resp.json();
  },

  async getPipelineStatus(sessionId) {
    const resp = await fetch(`${API_BASE}/api/pipeline-status?session_id=${sessionId}`, {
      headers: this.getHeaders()
    });
    if (!resp.ok) throw new Error(`Session introuvable : ${resp.status}`);
    return resp.json();
  },

  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    const resp = await fetch(`${API_BASE}/api/upload`, { 
      method: 'POST', 
      headers: this.getHeaders(true),
      body: formData 
    });
    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.detail || `Erreur upload CSV : ${resp.status}`);
    }
    return resp.json();
  },

  async uploadBackup(file, restoreDbName = null, dbHost = null, dbUser = null, dbPassword = null, { signal } = {}) {
    const formData = new FormData();
    formData.append('file', file);
    if (restoreDbName) formData.append('restore_db_name', restoreDbName);
    if (dbHost)        formData.append('db_host', dbHost);
    if (dbUser)        formData.append('db_user', dbUser);
    if (dbPassword)    formData.append('db_password', dbPassword);

    const resp = await fetch(`${API_BASE}/api/upload-backup`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData,
      signal, // AbortController — permet d'annuler un RESTORE trop long côté UI
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(data.detail || data.message || data.restore_error || `Erreur upload backup : ${resp.status}`);
    }
    return data;
  },

  /**
   * Déclenche le pont Docker automatique pour un .bak déjà uploadé dont la
   * restauration classique a échoué (version incompatible). Démarre un
   * conteneur SQL Server à la bonne version, y restaure le .bak, et renvoie
   * les infos de connexion du conteneur (bridge_info).
   */
  async runBackupBridge(filePath, restoreDbName = null, { signal } = {}) {
    const resp = await fetch(`${API_BASE}/api/upload-backup-bridge`, {
      method: 'POST',
      headers: { ...this.getHeaders(false), 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: filePath, restore_db_name: restoreDbName || null }),
      signal,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(data.detail || data.message || data.restore_error || `Erreur bridge : ${resp.status}`);
    }
    return data;
  },

  /**
   * Version streaming NDJSON du pont Docker. Consomme la réponse ligne par
   * ligne et relaie chaque event via `onEvent({phase,status,message,...})`.
   * L'event final contient `final: true` et `result: {...}`.
   * `signal` (AbortController) permet d'annuler côté UI.
   */
  async runBackupBridgeStream(filePath, restoreDbName = null, onEvent = () => {}, { signal } = {}) {
    const resp = await fetch(`${API_BASE}/api/upload-backup-bridge/stream`, {
      method: 'POST',
      headers: { ...this.getHeaders(false), 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: filePath, restore_db_name: restoreDbName || null }),
      signal,
    });

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.detail || data.message || `Erreur bridge stream : ${resp.status}`);
    }
    if (!resp.body) {
      throw new Error("Le navigateur ne supporte pas le streaming (ReadableStream manquant)");
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let finalResult = null;

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          let ev;
          try { ev = JSON.parse(line); }
          catch { continue; }
          try { onEvent(ev); } catch { /* handler ne doit pas casser le stream */ }
          if (ev && ev.final && ev.result) finalResult = ev.result;
        }
      }
    } finally {
      try { reader.releaseLock(); } catch { /* noop */ }
    }

    if (!finalResult) {
      throw new Error("Pont Docker terminé sans événement final — connexion coupée ?");
    }
    return finalResult;
  },

  getPdfUrl(sessionId) { return `${API_BASE}/api/export-pdf?session_id=${sessionId}`; },
  getKtrDownloadUrl(sessionId) { return `${API_BASE}/api/export-ktr?session_id=${sessionId}`; },

  async exportJson(sessionId) {
    const resp = await fetch(`${API_BASE}/api/export-json?session_id=${sessionId}`, {
      headers: this.getHeaders()
    });
    if (!resp.ok) throw new Error(`Erreur export JSON : ${resp.status}`);
    return resp.json();
  },

  async sendEmailReport(sessionId, email, includePdf = true) {
    const resp = await fetch(`${API_BASE}/api/notify-email`, {
      method: 'POST', headers: this.getHeaders(),
      body: JSON.stringify({ session_id: sessionId, email, include_pdf: includePdf }),
    });
    if (!resp.ok) throw new Error(`Erreur email : ${resp.status}`);
    return resp.json();
  },

  streamPipeline(sessionId, onEvent, onError) {
    // Le token doit passer en query param pour EventSource (pas de header custom).
    const token = localStorage.getItem('auth_token') || '';
    const url = `${API_BASE}/api/pipeline-stream?session_id=${encodeURIComponent(sessionId)}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
    const es = new EventSource(url, { withCredentials: true });
    let attempts = 0;
    es.onmessage = (e) => { try { onEvent(JSON.parse(e.data)); } catch { } };
    es.onerror = (err) => {
      attempts += 1;
      // Après 3 reconnexions infructueuses, on considère la session perdue
      // (typiquement un 401 → token invalide). On ferme et on déconnecte.
      if (attempts >= 3 && es.readyState === EventSource.CLOSED) {
        es.close();
        handleUnauthorized();
      }
      if (onError) onError(err);
    };
    return () => es.close();
  },

  async login(email, password) {
    const resp = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!resp.ok) {
      const e = await resp.json().catch(() => ({}));
      throw new Error(formatErrorPayload(e, 'Identifiants incorrects'));
    }
    return resp.json();
  },

  async register(email, password, prefix = '') {
    const resp = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, prefix }),
    });
    if (!resp.ok) {
      const e = await resp.json().catch(() => ({}));
      throw new Error(formatErrorPayload(e, "Erreur lors de l'inscription"));
    }
    return resp.json();
  },

  // --- Profil utilisateur ------------------------------------------------

  async getProfile() {
    const resp = await fetch(`${API_BASE}/api/auth/me`, { headers: this.getHeaders() });
    if (resp.status === 401) {
      handleUnauthorized();
      throw new Error('Session expirée — veuillez vous reconnecter');
    }
    if (!resp.ok) {
      const e = await resp.json().catch(() => ({}));
      throw new Error(formatErrorPayload(e, 'Impossible de charger le profil'));
    }
    return resp.json();
  },

  async updateProfile(patch) {
    const resp = await fetch(`${API_BASE}/api/auth/me`, {
      method: 'PATCH', headers: this.getHeaders(),
      body: JSON.stringify(patch),
    });
    if (!resp.ok) {
      const e = await resp.json().catch(() => ({}));
      throw new Error(formatErrorPayload(e, 'Mise à jour impossible'));
    }
    return resp.json();
  },

  async changePassword(currentPassword, newPassword) {
    const resp = await fetch(`${API_BASE}/api/auth/me/password`, {
      method: 'POST', headers: this.getHeaders(),
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    if (!resp.ok) {
      const e = await resp.json().catch(() => ({}));
      throw new Error(formatErrorPayload(e, 'Changement de mot de passe impossible'));
    }
    return resp.json();
  },

  async uploadAvatar(file) {
    const fd = new FormData();
    fd.append('file', file);
    const resp = await fetch(`${API_BASE}/api/auth/avatar`, {
      method: 'POST', headers: this.getHeaders(true), body: fd,
    });
    if (!resp.ok) {
      const e = await resp.json().catch(() => ({}));
      throw new Error(formatErrorPayload(e, "Envoi de l'avatar impossible"));
    }
    return resp.json();
  },

  getAvatarUrl(userId, bust) {
    const qs = bust ? `?v=${bust}` : '';
    return `${API_BASE}/api/auth/avatar/${userId}${qs}`;
  },

  async getSessions(userId) {
    const resp = await fetch(`${API_BASE}/api/sessions?user_id=${userId}`);
    if (!resp.ok) throw new Error('Erreur sessions');
    return resp.json();
  },

  async checkHealth() {
    try {
      const resp = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
      return resp.ok;
    } catch { return false; }
  },
};
