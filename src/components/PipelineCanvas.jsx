import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity, AlertCircle, BrainCircuit, CheckCircle2, Clock, Database, DownloadCloud, MessageSquare, RefreshCw, Rocket,
  Search, Settings2, ShieldCheck,Sparkles,UploadCloud,
  UserCheck, Waves, 
  Wrench, Zap 
} from 'lucide-react';
// src/components/PipelineCanvas.jsx — Modern Stepper Pipeline Visualization v4.0
import { useEffect, useMemo, useRef, useState } from 'react';
import { AGENT_ORDER, usePipelineStore } from '../store/pipelineStore';

// ── Pipeline stages (grouped agents → logical steps) ────────────────────────
const PIPELINE_STAGES = [
  {
    id: 'ingestion',
    label: 'Source Audit',
    subtitle: 'Data profiling & Schema discovery',
    icon: Search,
    color: 'blue',
    agents: ['explorer', 'data_quality'],
  },
  {
    id: 'drift',
    label: 'Drift Detection',
    subtitle: 'Schema evolution monitoring',
    icon: Waves,
    color: 'cyan',
    agents: ['drift_detector'],
  },
  {
    id: 'modeling',
    label: 'Schema Modeling',
    subtitle: 'Star schema dimensional design',
    icon: BrainCircuit,
    color: 'purple',
    agents: ['modeler', 'critic'],
  },
  {
    id: 'validation',
    label: 'Human Review',
    subtitle: 'HITL approval checkpoint',
    icon: UserCheck,
    color: 'amber',
    agents: ['human_review', 'chat_modifier'],
  },
  {
    id: 'etl_gen',
    label: 'ETL Blueprint',
    subtitle: 'Code generation & logic mapping',
    icon: Settings2,
    color: 'emerald',
    agents: ['etl_tsql_generator'],
  },
  {
    id: 'etl_extract',
    label: 'Extract',
    subtitle: 'Data ingestion from source',
    icon: DownloadCloud,
    color: 'cyan',
    agents: ['etl_extractor'],
  },
  {
    id: 'etl_transform',
    label: 'Transform',
    subtitle: 'SK Resolution & cleaning',
    icon: RefreshCw,
    color: 'purple',
    agents: ['etl_transformer'],
  },
  {
    id: 'etl_load',
    label: 'Load',
    subtitle: 'Fact table population',
    icon: UploadCloud,
    color: 'emerald',
    agents: ['etl_loader', 'healer'],
  },
  {
    id: 'lineage',
    label: 'Lineage Tracking',
    subtitle: 'Data provenance & audit trail',
    icon: Activity,
    color: 'indigo',
    agents: ['lineage_tracker', 'cataloger'],
  },
];

const COLOR_MAP = {
  blue:    { bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    text: 'text-blue-400',    icon: 'bg-blue-500',    ring: 'ring-blue-500/40',    dot: 'bg-blue-400'    },
  cyan:    { bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30',    text: 'text-cyan-400',    icon: 'bg-cyan-500',    ring: 'ring-cyan-500/40',    dot: 'bg-cyan-400'    },
  purple:  { bg: 'bg-purple-500/10',  border: 'border-purple-500/30',  text: 'text-purple-400',  icon: 'bg-purple-500',  ring: 'ring-purple-500/40',  dot: 'bg-purple-400'  },
  amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-400',   icon: 'bg-amber-500',   ring: 'ring-amber-500/40',   dot: 'bg-amber-400'   },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', icon: 'bg-emerald-500', ring: 'ring-emerald-500/40', dot: 'bg-emerald-400' },
  indigo:  { bg: 'bg-indigo-500/10',  border: 'border-indigo-500/30',  text: 'text-indigo-400',  icon: 'bg-indigo-500',  ring: 'ring-indigo-500/40',  dot: 'bg-indigo-400'  },
};

function getStageStatus(stage, agentStatuses, currentAgent) {
  const agents = stage.agents;
  const anyRunning = agents.some(a => agentStatuses[a] === 'running' || currentAgent === a);
  const anyError   = agents.some(a => agentStatuses[a] === 'error');
  // Exclude agents that are still 'idle' (never ran) so optional agents don't block 'done'
  const ranAgents  = agents.filter(a => agentStatuses[a] !== undefined && agentStatuses[a] !== 'idle');
  const allDone    = ranAgents.length > 0 && ranAgents.every(a => agentStatuses[a] === 'done');
  if (anyError)   return 'error';
  if (allDone)    return 'done';
  if (anyRunning) return 'running';
  return 'idle';
}

function StageCard({ stage, status, idx, isLast, executionLog }) {
  const c = COLOR_MAP[stage.color];
  const Icon = stage.icon;

  const card = {
    idle:    '',
    running: `${c.border} ${c.bg} ring-2 ${c.ring}`,
    done:    'border-emerald-500/20 bg-emerald-500/[0.03]',
    error:   'border-rose-500/30 bg-rose-500/5 ring-2 ring-rose-500/20',
  }[status];
  const cardStyle = status === 'idle' ? { borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' } : {};

  const iconBg = {
    idle:    '',
    running: `${c.icon} text-white shadow-lg`,
    done:    'bg-emerald-500 text-white',
    error:   'bg-rose-500 text-white',
  }[status];
  const iconBgStyle = status === 'idle' ? { background: 'var(--bg-elevated)', color: 'var(--text-muted)' } : {};

  // Extraction des logs spécifiques à cette étape
  const relevantLogs = useMemo(() => {
    if (!executionLog) return [];
    return executionLog.filter(log => 
       stage.agents.some(agent => {
          const agentClean = agent.replace(/_/g, ' ').toLowerCase();
          return log.toLowerCase().includes(agentClean) || log.toLowerCase().includes(agent.toLowerCase());
       })
    ).slice(-4); // Garder les 4 derniers messages pertinents
  }, [executionLog, stage.agents]);

  return (
    <div className="flex items-stretch gap-0">
      {/* Connector line + step number */}
      <div className="flex flex-col items-center w-12 shrink-0 pt-5">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black z-10 transition-all duration-500 ${
          status === 'done' ? 'bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]'
          : status === 'running' ? `${c.icon} text-white shadow-lg`
          : status === 'error' ? 'bg-rose-500 text-white'
          : ''
        }`}
        style={status === 'idle' ? { background: 'var(--bg-elevated)', color: 'var(--text-muted)' } : {}}>
          {status === 'done' ? <CheckCircle2 size={16} />
          : status === 'error' ? <AlertCircle size={16} />
          : status === 'running' ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
            />
          ) : (
            <span>{idx + 1}</span>
          )}
        </div>
        {!isLast && (
          <div className={`w-px flex-1 mt-2 transition-all duration-700 ${
            status === 'done' ? 'bg-emerald-500/40' : ''
          }`} style={status !== 'done' ? { background: 'var(--border-subtle)' } : {}} />
        )}
      </div>

      {/* Stage card */}
      <motion.div
        layout
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: idx * 0.06 }}
        className={`flex-1 mb-3 p-5 rounded-3xl border transition-all duration-500 ${card}`}
        style={cardStyle}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 shrink-0 ${iconBg} ${
              status === 'running' ? 'animate-pulse' : ''
            }`}
            style={iconBgStyle}>
              <Icon size={18} />
            </div>
            <div>
              <div className="text-sm font-black italic tracking-tighter transition-colors"
                style={{ color: status === 'idle' ? 'var(--text-secondary)' : '#fff' }}>
                {stage.label.toUpperCase()}
              </div>
              <div className="text-[10px] font-medium mt-0.5 tracking-tight" style={{ color: 'var(--text-muted)' }}>{stage.subtitle}</div>
            </div>
          </div>

          <div className="shrink-0">
            {status === 'done' && (
              <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 uppercase tracking-widest">
                <CheckCircle2 size={10} /> Terminé
              </span>
            )}
            {status === 'running' && (
              <span className={`flex items-center gap-1.5 text-[10px] font-black ${c.text} ${c.bg} px-3 py-1 rounded-full ${c.border} border uppercase tracking-widest`}>
                <motion.div
                  className={`w-1.5 h-1.5 rounded-full ${c.dot}`}
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
                En cours
              </span>
            )}
            {status === 'error' && (
              <span className="flex items-center gap-1.5 text-[10px] font-black text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20 uppercase tracking-widest">
                <AlertCircle size={10} /> Erreur
              </span>
            )}
          </div>
        </div>

        {/* Detailed logs & sub-steps when running or error */}
        <AnimatePresence>
          {(status === 'running' || status === 'error') && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-5 pt-4 space-y-4"
              style={{ borderTop: '1px solid var(--border-subtle)' }}
            >
              {/* Agent Indicators */}
              <div className="flex flex-wrap gap-2">
                {stage.agents.map(a => (
                  <div key={a} className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-wider ${
                    status === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : `${c.bg} ${c.border} ${c.text}`
                  }`}>
                    <Zap size={10} className={status === 'running' ? 'animate-pulse' : ''} />
                    {a.replace(/_/g, ' ')}
                  </div>
                ))}
              </div>

              {/* Dynamic Log Stream */}
              {relevantLogs.length > 0 && (
                <div className="rounded-xl p-3 font-mono text-[10px] space-y-1.5" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                  {relevantLogs.map((log, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex gap-3"
                      style={{ color: log.includes('❌') || log.includes('ERROR') ? 'var(--red-400)' : 'var(--text-secondary)' }}
                    >
                      <span className="select-none" style={{ color: 'var(--text-dim)' }}>{'>'}</span>
                      <span className="flex-1 leading-relaxed">{log}</span>
                    </motion.div>
                  ))}
                </div>
              )}

              {status === 'running' && (
                <div className="flex items-center justify-between px-1">
                   <div className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-indigo-500 animate-ping" />
                      <span className="text-[9px] font-black uppercase tracking-widest italic" style={{ color: 'var(--text-muted)' }}>Traitement en cours...</span>
                   </div>
                   <Activity size={12} className="animate-spin-slow" style={{ color: 'var(--text-dim)' }} />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function ProgressBar({ stages, agentStatuses, currentAgent, pipelineStatus }) {
  const done = stages.filter(s => getStageStatus(s, agentStatuses, currentAgent) === 'done').length;
  const rawPct = Math.round((done / stages.length) * 100);
  // Only show 100% when backend confirms pipeline_complete — avoid premature 100%
  const pct = (rawPct >= 100 && pipelineStatus !== 'complete') ? 99 : rawPct;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between text-[11px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
        <span>{done} / {stages.length} étapes terminées</span>
        <span style={{ color: 'var(--text-secondary)' }}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

// Durée minimale d'affichage du statut "running" pour chaque étape (ms)
// FIX: Augmenté pour rendre les étapes ETL visuellement crédibles (pas un "flash")
const MIN_RUNNING_MS = 2500;
// Gap visuel entre la fin d'une étape ETL et le début de la suivante (ms)
// FIX: Augmenté pour bien séparer les étapes Extract → Transform → Load
const ETL_STEP_GAP   = 1200;
// Chaîne ETL séquentielle : chaque agent attend la fin visuelle du précédent
const ETL_CHAIN = ['etl_extractor', 'etl_transformer', 'etl_loader'];

export default function PipelineCanvas() {
  const { agentStatuses, currentAgent, pipelineStatus, dqScore, executionLog } = usePipelineStore();

  const isIdle      = pipelineStatus === 'idle';
  const isComplete  = pipelineStatus === 'complete';
  const isError     = pipelineStatus === 'error';

  // ── Durée minimale visuelle + délai séquentiel ETL ─────────────────────────
  // runningStart : quand l'agent a *visuellement* commencé à tourner
  // doneShownAt  : quand l'agent a *visuellement* affiché 'done'
  const runningStart = useRef({});
  const doneShownAt  = useRef({});
  const [visualStatus, setVisualStatus] = useState({});
  // FIX: Stocke les timers par agent pour ne pas les annuler quand d'autres agents changent
  const agentTimers = useRef({});

  useEffect(() => {
    Object.entries(agentStatuses).forEach(([agent, status]) => {
      // Si on a déjà un timer en cours pour cet agent, ne pas en recréer un
      if (agentTimers.current[agent]) return;

      if (status === 'running') {
        // Pour les agents ETL (sauf le premier), attendre que le précédent
        // ait affiché 'done' depuis au moins ETL_STEP_GAP ms.
        const chainIdx = ETL_CHAIN.indexOf(agent);
        let runDelay = 0;
        if (chainIdx > 0) {
          const prevAgent  = ETL_CHAIN[chainIdx - 1];
          const prevDoneAt = doneShownAt.current[prevAgent] || 0;
          const elapsed    = Date.now() - prevDoneAt;
          if (elapsed < ETL_STEP_GAP) runDelay = ETL_STEP_GAP - elapsed;
        }

        // Appliquer immédiatement le statut visuel
        runningStart.current[agent] = Date.now();
        setVisualStatus(prev => ({ ...prev, [agent]: 'running' }));

        // Programmer la fin du statut "running" (minimum duration)
        agentTimers.current[agent] = setTimeout(() => {
          delete agentTimers.current[agent];
        }, runDelay + MIN_RUNNING_MS);

      } else if (status === 'done') {
        const started = runningStart.current[agent] || 0;
        const elapsed = Date.now() - started;
        const delay   = Math.max(0, MIN_RUNNING_MS - elapsed);

        // FIX: Si l'agent n'a pas encore atteint le temps minimum en "running",
        // on retarde le passage visuel à "done" pour respecter MIN_RUNNING_MS
        if (elapsed < MIN_RUNNING_MS && visualStatus[agent] !== 'done') {
          agentTimers.current[agent] = setTimeout(() => {
            doneShownAt.current[agent] = Date.now();
            setVisualStatus(prev => ({ ...prev, [agent]: 'done' }));
            delete agentTimers.current[agent];
          }, delay);
        } else {
          // Temps minimum déjà atteint, appliquer immédiatement
          doneShownAt.current[agent] = Date.now();
          setVisualStatus(prev => ({ ...prev, [agent]: 'done' }));
        }

      } else {
        setVisualStatus(prev => ({ ...prev, [agent]: status }));
      }
    });

    // Cleanup: annule uniquement les timers des agents qui ont été supprimés
    return () => {
      Object.keys(agentTimers.current).forEach(agent => {
        if (!agentStatuses[agent]) {
          clearTimeout(agentTimers.current[agent]);
          delete agentTimers.current[agent];
        }
      });
    };
  }, [agentStatuses]);

  // Merge : visualStatus prend le dessus sur agentStatuses pour le rendu
  const effectiveStatuses = useMemo(() => ({ ...agentStatuses, ...visualStatus }), [agentStatuses, visualStatus]);

  const stageStatuses = useMemo(() =>
    PIPELINE_STAGES.map(s => ({
      ...s,
      status: getStageStatus(s, effectiveStatuses, currentAgent)
    })),
    [effectiveStatuses, currentAgent]
  );

  const activeStage = stageStatuses.find(s => s.status === 'running');
  const errorCount  = executionLog?.filter(l => l.includes('❌') || l.includes('ERROR')).length || 0;

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Subtle ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/4 blur-[100px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-600/4 blur-[100px] rounded-full" />
      </div>

      {/* ── IDLE STATE ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isIdle && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-10"
          >
            <div className="flex flex-col items-center gap-6 text-center max-w-sm">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                <Sparkles size={28} style={{ color: 'var(--text-muted)' }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Prêt à orchestrer</h3>
                <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>Lancez un pipeline pour commencer</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ACTIVE PIPELINE VIEW ──────────────────────────────────────── */}
      {!isIdle && (
        <div className="relative z-10 h-full overflow-y-auto">
          <div className="p-6 max-w-xl mx-auto">

            {/* Stats row */}
            <div className="flex items-center gap-3 mb-6">
              {/* Current agent badge */}
              {activeStage && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`flex items-center gap-2 text-[11px] font-semibold px-3 py-1.5 rounded-full border ${COLOR_MAP[activeStage.color].bg} ${COLOR_MAP[activeStage.color].border} ${COLOR_MAP[activeStage.color].text}`}
                >
                  <motion.div
                    className={`w-1.5 h-1.5 rounded-full ${COLOR_MAP[activeStage.color].dot}`}
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                  {activeStage.label}
                </motion.div>
              )}

              {isComplete && (
                <span className="flex items-center gap-2 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                  <CheckCircle2 size={12} /> Pipeline Terminé
                </span>
              )}

              {isError && (
                <span className="flex items-center gap-2 text-[11px] font-semibold text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-full border border-rose-500/20">
                  <AlertCircle size={12} /> {errorCount > 0 ? `${errorCount} erreurs` : 'Erreur Pipeline'}
                </span>
              )}

              {dqScore !== null && (
                <span className={`ml-auto flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full border ${
                  dqScore >= 80 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  : dqScore >= 60 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                  : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                }`}>
                  <ShieldCheck size={11} />
                  DQ {Math.round(dqScore)}%
                </span>
              )}
            </div>

            {/* Progress bar */}
            <ProgressBar stages={stageStatuses} agentStatuses={agentStatuses} currentAgent={currentAgent} pipelineStatus={pipelineStatus} />

            {/* Stage cards */}
            <div>
              {stageStatuses.map((stage, idx) => (
                <StageCard
                  key={stage.id}
                  stage={stage}
                  status={stage.status}
                  idx={idx}
                  isLast={idx === stageStatuses.length - 1}
                  executionLog={executionLog}
                />
              ))}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
