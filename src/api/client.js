// src/api/client.js — Couche d'abstraction API complète production
const API_BASE = import.meta.env.MODE === 'production' ? (import.meta.env.VITE_API_URL || '') : '';

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
      throw new Error(errData.detail || `Erreur upload : ${resp.status}`);
    }
    return resp.json();
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
    const es = new EventSource(`${API_BASE}/api/pipeline-stream?session_id=${sessionId}`);
    es.onmessage = (e) => { try { onEvent(JSON.parse(e.data)); } catch { } };
    es.onerror = (err) => { if (onError) onError(err); };
    return () => es.close();
  },

  async login(email, password) {
    const resp = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!resp.ok) throw new Error('Identifiants incorrects');
    return resp.json();
  },

  async register(email, password, prefix = '') {
    const resp = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, prefix }),
    });
    if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e.detail || 'Erreur inscription'); }
    return resp.json();
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
