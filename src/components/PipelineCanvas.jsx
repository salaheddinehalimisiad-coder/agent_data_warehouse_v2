// src/components/PipelineCanvas.jsx — Modern Stepper Pipeline Visualization v4.0
import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePipelineStore, AGENT_ORDER } from '../store/pipelineStore';
import {
  Search, Waves, BrainCircuit, ShieldCheck,
  UserCheck, MessageSquare, Settings2, Rocket,
  Wrench, CheckCircle2, Clock, AlertCircle, Sparkles,
  Activity, Database, Zap, DownloadCloud, RefreshCw, UploadCloud
} from 'lucide-react';

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
    agents: ['etl_generator'],
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
  const allDone    = agents.every(a => agentStatuses[a] === 'done');
  const anyRunning = agents.some(a => agentStatuses[a] === 'running' || currentAgent === a);
  const anyError   = agents.some(a => agentStatuses[a] === 'error');
  if (anyError)   return 'error';
  if (allDone)    return 'done';
  if (anyRunning) return 'running';
  return 'idle';
}

function StageCard({ stage, status, idx, isLast, executionLog }) {
  const c = COLOR_MAP[stage.color];
  const Icon = stage.icon;

  const card = {
    idle:    'border-white/[0.06] bg-white/[0.02]',
    running: `${c.border} ${c.bg} ring-2 ${c.ring}`,
    done:    'border-emerald-500/20 bg-emerald-500/[0.03]',
    error:   'border-rose-500/30 bg-rose-500/5 ring-2 ring-rose-500/20',
  }[status];

  const iconBg = {
    idle:    'bg-white/5 text-slate-600',
    running: `${c.icon} text-white shadow-lg`,
    done:    'bg-emerald-500 text-white',
    error:   'bg-rose-500 text-white',
  }[status];

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
          : 'bg-white/[0.06] text-slate-600'
        }`}>
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
            status === 'done' ? 'bg-emerald-500/40' : 'bg-white/[0.06]'
          }`} />
        )}
      </div>

      {/* Stage card */}
      <motion.div
        layout
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: idx * 0.06 }}
        className={`flex-1 mb-3 p-5 rounded-3xl border transition-all duration-500 ${card}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 shrink-0 ${iconBg} ${
              status === 'running' ? 'animate-pulse' : ''
            }`}>
              <Icon size={18} />
            </div>
            <div>
              <div className={`text-sm font-black italic tracking-tighter transition-colors ${
                status === 'idle' ? 'text-slate-500' : 'text-white'
              }`}>
                {stage.label.toUpperCase()}
              </div>
              <div className="text-[10px] font-medium text-slate-500 mt-0.5 tracking-tight">{stage.subtitle}</div>
            </div>
          </div>

          <div className="shrink-0">
            {status === 'done' && (
              <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 uppercase tracking-widest">
                <CheckCircle2 size={10} /> Done
              </span>
            )}
            {status === 'running' && (
              <span className={`flex items-center gap-1.5 text-[10px] font-black ${c.text} ${c.bg} px-3 py-1 rounded-full ${c.border} border uppercase tracking-widest`}>
                <motion.div
                  className={`w-1.5 h-1.5 rounded-full ${c.dot}`}
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
                Live
              </span>
            )}
            {status === 'error' && (
              <span className="flex items-center gap-1.5 text-[10px] font-black text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20 uppercase tracking-widest">
                <AlertCircle size={10} /> Fail
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
              className="mt-5 pt-4 border-t border-white/5 space-y-4"
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
                <div className="bg-black/40 rounded-xl p-3 border border-white/5 font-mono text-[10px] space-y-1.5">
                  {relevantLogs.map((log, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex gap-3 ${log.includes('❌') || log.includes('ERROR') ? 'text-rose-400' : 'text-slate-400'}`}
                    >
                      <span className="text-slate-700 select-none">{'>'}</span>
                      <span className="flex-1 leading-relaxed">{log}</span>
                    </motion.div>
                  ))}
                </div>
              )}

              {status === 'running' && (
                <div className="flex items-center justify-between px-1">
                   <div className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-indigo-500 animate-ping" />
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Neuronal Processing...</span>
                   </div>
                   <Activity size={12} className="text-slate-700 animate-spin-slow" />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function ProgressBar({ stages, agentStatuses, currentAgent }) {
  const done = stages.filter(s => getStageStatus(s, agentStatuses, currentAgent) === 'done').length;
  const pct  = Math.round((done / stages.length) * 100);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-2">
        <span>{done} / {stages.length} stages completed</span>
        <span className="text-slate-400">{pct}%</span>
      </div>
      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
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

export default function PipelineCanvas() {
  const { agentStatuses, currentAgent, pipelineStatus, dqScore, executionLog } = usePipelineStore();

  const isIdle      = pipelineStatus === 'idle';
  const isComplete  = pipelineStatus === 'complete';
  const isError     = pipelineStatus === 'error';

  const stageStatuses = useMemo(() =>
    PIPELINE_STAGES.map(s => ({
      ...s,
      status: getStageStatus(s, agentStatuses, currentAgent)
    })),
    [agentStatuses, currentAgent]
  );

  const activeStage = stageStatuses.find(s => s.status === 'running');
  const errorCount  = executionLog?.filter(l => l.includes('❌') || l.includes('ERROR')).length || 0;

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#0a0a0f]">
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
              <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                <Sparkles size={28} className="text-slate-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-400">Ready to orchestrate</h3>
                <p className="text-[12px] text-slate-600 mt-1">Initialize a pipeline to begin</p>
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
                  <CheckCircle2 size={12} /> Pipeline Complete
                </span>
              )}

              {isError && (
                <span className="flex items-center gap-2 text-[11px] font-semibold text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-full border border-rose-500/20">
                  <AlertCircle size={12} /> {errorCount > 0 ? `${errorCount} errors` : 'Pipeline Error'}
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
            <ProgressBar stages={stageStatuses} agentStatuses={agentStatuses} currentAgent={currentAgent} />

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
