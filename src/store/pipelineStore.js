// src/store/pipelineStore.js — État global Zustand v3.0
/**
 * v3.0 — Nouveaux champs d'état :
 *   dqReport  : rapport complet Data Quality
 *   dqScore   : score DQ global 0-100
 *   dqAlerts  : liste d'alertes DQ
 *   lineage   : graphe de lignage source → DW
 *
 * CORRECTIONS v2.1 maintenues :
 *   1. SSE connecté AVANT l'appel /api/start
 *   2. initial_state hydrate tous les champs
 *   3. sendMessage met à jour pipelineStatus
 *   4. resetPipeline ferme proprement le SSE
 *   5. Reconnexion SSE automatique
 */
import { create } from 'zustand';
import { apiClient } from '../api/client';

export const AGENT_STATUS = {
  IDLE:    'idle',
  RUNNING: 'running',
  DONE:    'done',
  ERROR:   'error',
  WAITING: 'waiting',
};

export const AGENT_STATUS_COLORS = {
  idle:    { bg: '#1a1a1f', border: '#2d2d35',  text: '#52525b' },
  running: { bg: '#1e1b4b', border: '#6366f1',  text: '#a5b4fc' },
  done:    { bg: '#052e16', border: '#22c55e',  text: '#86efac' },
  error:   { bg: '#450a0a', border: '#ef4444',  text: '#fca5a5' },
  waiting: { bg: '#431407', border: '#f59e0b',  text: '#fcd34d' },
};

export const AGENT_ORDER = [
  'explorer', 'data_quality', 'drift_detector', 'modeler', 'governance', 'critic',
  'human_review', 'chat_modifier', 'cdc_watermark', 'etl_tsql_generator', 'etl_extractor', 'etl_transformer', 'etl_loader',
  'healer', 'lineage_tracker', 'query_generator', 'insight_generator', 'forecaster', 'cataloger',
  'airflow_generator', 'dbt_generator', 'mock_generator'
];

const AGENT_EMOJIS = {
  explorer:         '🔍',
  data_quality:     '🛡️',
  drift_detector:   '🌊',
  modeler:          '🧠',
  governance:       '🛡️',
  critic:           '⚖️',
  human_review:     '👤',
  chat_modifier:    '💬',
  cdc_watermark:    '💧',
  etl_tsql_generator: '⚙️',
  etl_extractor:    '📥',
  etl_transformer:  '🔄',
  etl_loader:       '📤',
  healer:           '🔧',
  lineage_tracker:  '🔗',
  query_generator:  '📊',
  insight_generator:'💡',
  forecaster:       '📈',
  cataloger:        '📚',
  airflow_generator:'🌬️',
  dbt_generator:    '🏗️',
  mock_generator:   '🧪',
};

const initialAgentStatuses = Object.fromEntries(
  AGENT_ORDER.map(a => [a, AGENT_STATUS.IDLE])
);

const INITIAL_PIPELINE_STATE = {
  pipelineStatus:       'idle',
  agentStatuses:        { ...initialAgentStatuses },
  currentAgent:         null,
  sqlDDL:               '',
  previousSqlDDL:       '',
  etlCode:              '',
  criticReview:         '',
  criticApproved:       false,
  logicalModel:         null,
  logicalModelVersion:  0,
  schemaDriftDetected:  false,
  schemaDriftDetails:   '',
  healHistory:          [],
  pipelineProgress:     0,
  loadMetrics:          null,
  executionLog:         [],
  etlStatus:            'pending',
  messages:             [],
  sessionId:            null,
  // ─── NOUVEAU v3 ─────────────────────────────────────────────────────────
  dqReport:             null,
  dqScore:              null,
  dqAlerts:             [],
  lineage:              null,
  etlProgress:          null, // { inserted, rejected, total, pct, table }
  executiveSummary:     '',
  visualizations:       [],
  nodeDurations:        {},
  dataCatalog:          null,
  airflowDag:           null,
  dbtProject:           null,
  governanceReport:     null,
  mockDataSql:          null,
  sourceMetadata:       null,
  // ─── Phase 3 ────────────────────────────────────────────────────────
  generatedQueries:     [],
  queryResults:         [],
  etlMode:              null,
  etlWatermarks:        null,
  pipelineError:        null,
};

// ─── Helpers localStorage ─────────────────────────────────────────────────────

function _lsGet(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return JSON.parse(v);
  } catch { return fallback; }
}
function _lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore quota */ }
}
function _lsDel(...keys) {
  keys.forEach(k => { try { localStorage.removeItem(k); } catch { } });
}

export const usePipelineStore = create((set, get) => ({
  // ─── Auth ─────────────────────────────────────────────────────────────────
  userId:     null,
  userPrefix: 'dw',
  authToken:  null,

  ...INITIAL_PIPELINE_STATE,
  // Restauration des champs critiques depuis localStorage (survie au refresh)
  sessionId:        _lsGet('ps_sessionId',        null),
  generatedQueries: _lsGet('ps_generatedQueries', []),
  lineage:          _lsGet('ps_lineage',          null),
  loadMetrics:      _lsGet('ps_loadMetrics',      null),

  _sseCleanup: null,

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH
  // ═══════════════════════════════════════════════════════════════════════════

  setAuth: (token, userId, userPrefix) => {
    set({ authToken: token, userId, userPrefix });
    localStorage.setItem('auth_token',  token);
    localStorage.setItem('user_id',     String(userId));
    localStorage.setItem('user_prefix', userPrefix);
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_prefix');
    get()._sseCleanup?.();
    set({ authToken: null, userId: null, userPrefix: 'dw', ...INITIAL_PIPELINE_STATE });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PIPELINE
  // ═══════════════════════════════════════════════════════════════════════════

  resetPipeline: () => {
    get()._sseCleanup?.();
    _lsDel('ps_sessionId', 'ps_generatedQueries', 'ps_lineage', 'ps_loadMetrics');
    set({ ...INITIAL_PIPELINE_STATE, _sseCleanup: null });
  },

  startPipeline: async (connectionConfig, dwConnectionConfig) => {
    const { userId, userPrefix, authToken } = get();
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    _lsSet('ps_sessionId', sessionId);
    _lsDel('ps_generatedQueries');

    set({ ...INITIAL_PIPELINE_STATE, sessionId, pipelineStatus: 'starting' });

    // Connecter le SSE AVANT /api/start.
    // Depuis v3.2 le backend bufferise les events émis avant que le client
    // soit branché, donc la course n'est plus critique, mais on attend tout
    // de même `onopen` pour minimiser la latence ressentie.
    const { cleanup, ready } = _connectSSE(sessionId, authToken, set, get);
    set({ _sseCleanup: cleanup });

    // Attend l'ouverture effective (timeout défensif 1.5 s)
    await Promise.race([
      ready,
      new Promise(r => setTimeout(r, 1500)),
    ]);

    try {
      await apiClient.startPipeline({
        session_id: sessionId,
        connection_config: connectionConfig,
        dw_connection_config: dwConnectionConfig,
        user_id:    userId || 1,
        user_prefix: userPrefix || 'dw',
      });
      set({ pipelineStatus: 'running' });
    } catch (err) {
      set({ pipelineStatus: 'error' });
      console.error('[Store] startPipeline error:', err);
    }
  },

  validatePipeline: async (validated, comment = '') => {
    const { sessionId, authToken } = get();
    set({ pipelineStatus: 'running' });
    try {
      await apiClient.validatePipeline({ session_id: sessionId, validated, comment }, authToken);
    } catch (err) {
      set({ pipelineStatus: 'error' });
      console.error('[Store] validate error:', err);
    }
  },

  sendMessage: async (message, context = 'sql', mode = 'architecture') => {
    const { sessionId, authToken, executeQuery } = get();
    
    if (mode === 'query') {
      return executeQuery(message);
    }

    set({ 
      pipelineStatus: 'running',
      messages: [...get().messages, { role: 'user', content: message, id: Date.now() }]
    });
    
    try {
      const resp = await apiClient.sendChat({ session_id: sessionId, message, context }, authToken);
      
      const assistantWaitId = Date.now() + 1;
      set(state => ({
        messages: [...state.messages, { role: 'assistant', content: '', id: assistantWaitId }],
      }));

      // Implémentation du comportement SSE (Streaming) pour le rendu fluide
      // Évite de bloquer l'UI lors de la réception de gros blocs Markdown
      const chunks = resp.reply.match(/[\s\S]{1,12}/g) || [];
      let currentIdx = 0;
      
      const streamInterval = setInterval(() => {
          if (currentIdx < chunks.length) {
              const chunk = chunks[currentIdx];
              set(state => ({
                  messages: state.messages.map(m => m.id === assistantWaitId ? {
                      ...m, content: m.content + chunk
                  } : m)
              }));
              currentIdx++;
          } else {
              clearInterval(streamInterval);
              if (resp.sql_ddl)       set({ sqlDDL: resp.sql_ddl });
              if (resp.critic_review) set({ criticReview: resp.critic_review });
          }
      }, 15);
      
    } catch (err) {
      console.error('[Store] sendMessage error:', err);
    }
  },

  executeQuery: async (question) => {
    const { sessionId, authToken } = get();
    const waitId = Date.now();
    
    set({ 
      messages: [...get().messages, { role: 'user', content: question, id: waitId }]
    });
    
    const assistantWaitId = waitId + 1;
    set(state => ({
      messages: [...state.messages, { role: 'assistant', content: "🔍 Analyse neuronale en cours...", id: assistantWaitId }]
    }));

    try {
      const resp = await apiClient.executeQuery(sessionId, question, authToken);
      if (resp.success) {
        set(state => ({
          messages: state.messages.map(m => m.id === assistantWaitId ? {
            ...m,
            content: "Analyse terminée. Voici vos résultats :",
            queryResult: {
              sql: resp.sql,
              columns: resp.columns,
              rows: resp.rows,
              total_rows: resp.total_rows
            }
          } : m)
        }));
      } else {
        set(state => ({
          messages: state.messages.map(m => m.id === assistantWaitId ? {
            ...m, content: `❌ Erreur : ${resp.error}`
          } : m)
        }));
      }
    } catch (error) {
       set(state => ({
          messages: state.messages.map(m => m.id === assistantWaitId ? {
            ...m, content: `⚠️ Erreur système : ${error.message}`
          } : m)
        }));
    }
  },

  addMessage: (role, content) => {
    set({ messages: [...get().messages, { role, content }] });
  },
}));


// ─── Connexion SSE ────────────────────────────────────────────────────────────

function _connectSSE(sessionId, authToken, set, get) {
  const url = `/api/pipeline-stream?session_id=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(authToken || '')}`;
  let es    = null;
  let retryTimer = null;

  // Promise résolue dès que la 1re connexion EventSource est établie.
  let resolveReady;
  const ready = new Promise((r) => { resolveReady = r; });
  let firstOpen = true;

  function connect() {
    es = new EventSource(url, { withCredentials: true });

    es.onopen = () => {
      if (firstOpen) {
        firstOpen = false;
        resolveReady?.();
      }
    };

    es.onmessage = (e) => {
      try {
        const { type, data } = JSON.parse(e.data);
        _handleSSEEvent(type, data, set, get);
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      es.close();
      // On débloque `ready` quand même pour ne pas coincer /api/start
      resolveReady?.();
      retryTimer = setTimeout(connect, 3000);
    };
  }

  connect();

  const cleanup = () => {
    clearTimeout(retryTimer);
    es?.close();
  };
  return { cleanup, ready };
}


// Helper: treat empty logical_model {} (no fact_table) as null
function _sanitizeLogicalModel(model) {
  if (!model || typeof model !== 'object') return null;
  if (Object.keys(model).length === 0) return null;
  if (!model.fact_table && (!model.fact_tables || model.fact_tables.length === 0)) return null;
  return model;
}

function _handleSSEEvent(type, data, set, get) {
  switch (type) {

    case 'initial_state':
      set({
        sqlDDL:               data.sql_ddl               || '',
        previousSqlDDL:       data.previous_sql_ddl      || '',
        etlCode:              data.etl_code              || '',
        criticReview:         data.critic_review         || '',
        criticApproved:       data.critic_approved       || false,
        logicalModel:         _sanitizeLogicalModel(data.logical_model),
        logicalModelVersion:  data.logical_model_version || 0,
        schemaDriftDetected:  data.schema_drift_detected || false,
        schemaDriftDetails:   data.schema_drift_details  || '',
        healHistory:          data.heal_history          || [],
        executionLog:         data.execution_log         || [],
        etlStatus:            data.etl_status            || 'pending',
        // v3
        dqReport:             data.dq_report             || null,
        dqScore:              data.dq_score              ?? null,
        dqAlerts:             data.dq_alerts             || [],
        lineage:              data.lineage               || _lsGet('ps_lineage',      null),
        loadMetrics:          data.load_metrics          || _lsGet('ps_loadMetrics',   null),
        executiveSummary:     data.executive_summary     || '',
        visualizations:       data.visualizations        || [],
        nodeDurations:        data.node_durations        || {},
        dataCatalog:          data.data_catalog          || null,
        airflowDag:           data.airflow_dag           || null,
        dbtProject:           data.dbt_project           || null,
        governanceReport:     data.governance_report     || null,
        mockDataSql:          data.mock_data_sql         || null,
        sourceMetadata:       data.source_metadata       || null,
        // Phase 3
        generatedQueries:     data.generated_queries     || _lsGet('ps_generatedQueries', []),
        queryResults:         data.query_results         || [],
        etlMode:              data.etl_mode              || null,
        etlWatermarks:        data.etl_watermarks        || null,
      });
      break;

    case 'state_update': {
      const u = data.updates || {};
      const patch = {};
      if (u.sql_ddl               !== undefined) patch.sqlDDL               = u.sql_ddl;
      if (u.previous_sql_ddl      !== undefined) patch.previousSqlDDL       = u.previous_sql_ddl;
      if (u.etl_code              !== undefined) patch.etlCode              = u.etl_code;
      if (u.critic_review         !== undefined) patch.criticReview         = u.critic_review;
      if (u.critic_approved       !== undefined) patch.criticApproved       = u.critic_approved;
      if (u.logical_model         !== undefined) patch.logicalModel         = _sanitizeLogicalModel(u.logical_model);
      if (u.logical_model_version !== undefined) patch.logicalModelVersion  = u.logical_model_version;
      if (u.schema_drift_detected !== undefined) patch.schemaDriftDetected  = u.schema_drift_detected;
      if (u.schema_drift_details  !== undefined) patch.schemaDriftDetails   = u.schema_drift_details;
      if (u.heal_history          !== undefined) patch.healHistory           = u.heal_history;
      if (u.execution_log         !== undefined) patch.executionLog          = u.execution_log;
      if (u.etl_status            !== undefined) patch.etlStatus             = u.etl_status;
      // v3 — nouveaux champs
      if (u.dq_report             !== undefined) patch.dqReport              = u.dq_report;
      if (u.dq_score              !== undefined) patch.dqScore               = u.dq_score;
      if (u.dq_alerts             !== undefined) patch.dqAlerts              = u.dq_alerts;
      if (u.lineage               !== undefined) { patch.lineage      = u.lineage;      _lsSet('ps_lineage',      u.lineage);      }
      if (u.load_metrics          !== undefined) { patch.loadMetrics = u.load_metrics; _lsSet('ps_loadMetrics', u.load_metrics); }
      if (u.executive_summary     !== undefined) patch.executiveSummary      = u.executive_summary;
      if (u.visualizations          !== undefined) patch.visualizations        = u.visualizations;
      if (u.node_durations         !== undefined) patch.nodeDurations         = u.node_durations;
      if (u.data_catalog           !== undefined) patch.dataCatalog           = u.data_catalog;
      if (u.airflow_dag            !== undefined) patch.airflowDag            = u.airflow_dag;
      if (u.dbt_project            !== undefined) patch.dbtProject            = u.dbt_project;
      if (u.governance_report      !== undefined) patch.governanceReport      = u.governance_report;
      if (u.mock_data_sql          !== undefined) patch.mockDataSql           = u.mock_data_sql;
      if (u.source_metadata        !== undefined) patch.sourceMetadata        = u.source_metadata;
      // Phase 3
      if (u.generated_queries      !== undefined) {
        patch.generatedQueries = u.generated_queries;
        _lsSet('ps_generatedQueries', u.generated_queries);
      }
      if (u.query_results          !== undefined) patch.queryResults          = u.query_results;
      if (u.etl_mode               !== undefined) patch.etlMode              = u.etl_mode;
      if (u.etl_watermarks         !== undefined) patch.etlWatermarks        = u.etl_watermarks;

      if (data.agent) patch.currentAgent = data.agent;
      set(patch);
      break;
    }

    case 'agent_status': {
      const prev = get().agentStatuses || {};
      const updated = { ...prev, [data.agent]: data.status };
      const doneCount = Object.values(updated).filter(s => s === 'done').length;
      const progress = Math.round((doneCount / AGENT_ORDER.length) * 100);
      set({ agentStatuses: updated, pipelineProgress: progress });
      if (data.status === 'running') set({ currentAgent: data.agent });
      break;
    }

    case 'log':
      set({ executionLog: [...(get().executionLog || []), data.message] });
      break;

    case 'pipeline_status':
      if (data?.status === 'awaiting_review') {
        set({ pipelineStatus: 'awaiting_review' });
      }
      break;
    case 'human_review_required':
      set({
        pipelineStatus:       'awaiting_review',
        sqlDDL:               data.sql_ddl               || get().sqlDDL,
        criticReview:         data.critic_review         || get().criticReview,
        criticApproved:       data.critic_approved       ?? get().criticApproved,
        logicalModel:         _sanitizeLogicalModel(data.logical_model) || get().logicalModel,
        logicalModelVersion:  data.logical_model_version ?? get().logicalModelVersion,
        schemaDriftDetected:  data.schema_drift_detected ?? get().schemaDriftDetected,
        schemaDriftDetails:   data.schema_drift_details  || get().schemaDriftDetails,
        previousSqlDDL:       data.previous_sql_ddl      || get().previousSqlDDL,
      });
      break;

    case 'dq_review_required':
      set({
        pipelineStatus: 'awaiting_dq_review',
        dqScore:        data.dq_score   ?? get().dqScore,
        dqAlerts:       data.dq_alerts  || get().dqAlerts,
        dqReport:       data.dq_report  || get().dqReport,
      });
      break;

    case 'pipeline_complete':
      set({
        pipelineStatus: data.success ? 'complete' : 'error',
        currentAgent: null,
        etlStatus: data.success ? 'success' : get().etlStatus,
        pipelineError: data.success ? null : (data.summary?.error || data.summary?.reason || null),
      });
      break;

    case 'stage':
    case 'stage_change':
      if (data.stage === 'awaiting_human_review') {
        set({ pipelineStatus: 'awaiting_review' });
      } else if (['etl_generation', 'model_revision'].includes(data.stage)) {
        set({ pipelineStatus: 'running' });
      }
      break;

    case 'etl_progress':
      set({ etlProgress: data });
      break;

    default:
      break;
  }
}
