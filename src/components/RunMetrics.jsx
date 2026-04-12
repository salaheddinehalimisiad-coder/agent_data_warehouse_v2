// src/components/RunMetrics.jsx — Dashboard métriques post-chargement v2.0
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, CheckCircle2, XCircle, Database, Clock, Layers, Download, Trophy } from 'lucide-react';
import { usePipelineStore } from '../store/pipelineStore';
import HealHistory from './HealHistory';
import ExecutiveSummary from './ExecutiveSummary';

function LoadRing({ rate }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, rate) / 100) * circ;
  const color = rate >= 90 ? '#10b981' : rate >= 70 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative flex items-center justify-center">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="7" />
        <motion.circle
          cx="50" cy="50" r={r}
          fill="none" stroke={color} strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          transform="rotate(-90 50 50)"
          initial={{ strokeDasharray: `0 ${circ}` }}
          animate={{ strokeDasharray: `${dash} ${circ}` }}
          transition={{ duration: 1.8, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 8px ${color}60)` }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-black text-white">{rate}%</div>
        <div className="text-[8px] text-slate-500 uppercase tracking-widest font-black">Load Rate</div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, color = 'default' }) {
  const colors = {
    default: 'border-white/[0.06] bg-white/[0.02]',
    success: 'border-emerald-500/20 bg-emerald-500/[0.04]',
    warn:    'border-amber-500/20 bg-amber-500/[0.04]',
    error:   'border-rose-500/20 bg-rose-500/[0.04]',
    info:    'border-indigo-500/20 bg-indigo-500/[0.04]',
  };
  const textColors = {
    default: 'text-white',
    success: 'text-emerald-400',
    warn:    'text-amber-400',
    error:   'text-rose-400',
    info:    'text-indigo-400',
  };

  return (
    <div className={`rounded-2xl border p-5 ${colors[color]}`}>
      <div className={`text-3xl font-black tracking-tighter mb-1 ${textColors[color]}`}>{value}</div>
      <div className="text-[11px] font-bold text-white uppercase tracking-wider">{label}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function DimRow({ name, metrics }) {
  const inserted = metrics?.inserted || 0;
  const existing = metrics?.existing || 0;
  const total    = inserted + existing;
  const pct      = total > 0 ? Math.round((inserted / total) * 100) : 0;

  return (
    <div className="flex items-center gap-4 py-3 border-b border-white/[0.04] last:border-0">
      <div className="w-40 shrink-0">
        <div className="text-[11px] font-mono font-semibold text-slate-300 truncate">{name}</div>
      </div>
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-[10px] text-slate-500 w-24 text-right shrink-0">
        <span className="text-emerald-400 font-semibold">{inserted}</span> nouv · {existing} exist
      </div>
    </div>
  );
}

function grade(rate, rejected) {
  if (rate >= 95 && rejected === 0) return { g: 'A+', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' };
  if (rate >= 90 && rejected <= 2)  return { g: 'A',  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' };
  if (rate >= 80)                   return { g: 'B',  color: 'text-indigo-400',  bg: 'bg-indigo-500/10  border-indigo-500/30' };
  if (rate >= 60)                   return { g: 'C',  color: 'text-amber-400',   bg: 'bg-amber-500/10   border-amber-500/30' };
  return                                   { g: 'F',  color: 'text-rose-400',    bg: 'bg-rose-500/10    border-rose-500/30' };
}

export default function RunMetrics() {
  const { 
    loadMetrics, etlProgress, executiveSummary, visualizations, 
    etlStatus, pipelineStatus, sessionId, userPrefix, nodeDurations 
  } = usePipelineStore();

  const factMetrics = loadMetrics?.fact || {};
  const dimMetrics  = loadMetrics?.dimensions || {};
  const sourceRows  = loadMetrics?.source_rows || 0;
  const loadedAt    = loadMetrics?.loaded_at;

  const totalInserted = factMetrics.inserted || 0;
  const totalRejected = factMetrics.rejected || 0;
  const loadRate      = sourceRows > 0 ? Math.round((totalInserted / sourceRows) * 100) : 0;

  const loadTimeStr = useMemo(() => {
    if (!loadedAt) return null;
    return new Date(loadedAt).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }, [loadedAt]);

  const runGrade = grade(loadRate, totalRejected);

  const handleDownload = () => {
    const report = {
      session_id: sessionId,
      prefix: userPrefix,
      generated_at: new Date().toISOString(),
      load_rate_pct: loadRate,
      grade: runGrade.g,
      source_rows: sourceRows,
      facts_inserted: totalInserted,
      facts_rejected: totalRejected,
      loaded_at: loadedAt,
      dimensions: dimMetrics,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `run_metrics_${sessionId?.substring(0, 8) || 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!loadMetrics && !etlProgress) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 opacity-40">
        <BarChart3 size={32} className="text-slate-600" />
        <div className="text-center">
          <p className="text-[12px] font-black text-slate-500 uppercase tracking-widest">Métriques non disponibles</p>
          <p className="text-[10px] text-slate-600 mt-1">Les métriques apparaissent après un chargement DW réel</p>
        </div>
      </div>
    );
  }

  // Show progress if ETL is still running or no final metrics yet
  if (etlProgress && (!loadMetrics || pipelineStatus === 'running')) {
     return (
        <div className="h-full flex flex-col items-center justify-center p-10 bg-black/40">
           <div className="w-full max-w-sm space-y-8">
              <div className="text-center space-y-2">
                 <div className="inline-flex p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-2">
                    <Database size={24} className="animate-pulse" />
                 </div>
                 <h2 className="text-xl font-black text-white italic tracking-tighter uppercase">Synthesis in Progress</h2>
                 <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Active Table: {etlProgress.table}</p>
              </div>

              <div className="space-y-3">
                 <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <span>{etlProgress.inserted} rows processed</span>
                    <span>{etlProgress.pct}%</span>
                 </div>
                 <div className="h-2 rounded-full bg-white/5 border border-white/5 overflow-hidden p-0.5">
                    <motion.div 
                       initial={{ width: 0 }}
                       animate={{ width: `${etlProgress.pct}%` }}
                       className="h-full rounded-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                    />
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
                    <div className="text-xl font-black text-white">{etlProgress.inserted}</div>
                    <div className="text-[8px] font-bold text-slate-500 uppercase">Inserted</div>
                 </div>
                 <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
                    <div className={`text-xl font-black ${etlProgress.rejected > 0 ? 'text-rose-500' : 'text-slate-500'}`}>{etlProgress.rejected}</div>
                    <div className="text-[8px] font-bold text-slate-500 uppercase">Rejected</div>
                 </div>
              </div>
           </div>
        </div>
     );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <BarChart3 size={15} className="text-emerald-400" />
          </div>
          <div>
            <h2 className="text-[13px] font-black text-white">Métriques de chargement</h2>
            <p className="text-[10px] text-slate-500">{loadTimeStr || 'Dernier run ETL'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${runGrade.bg} ${runGrade.color}`}>
            Grade {runGrade.g}
          </span>
          <button
            onClick={handleDownload}
            className="p-2 rounded-xl border border-white/10 bg-white/5 text-slate-500 hover:text-emerald-400 hover:border-emerald-500/30 transition-all"
            title="Télécharger le rapport JSON"
          >
            <Download size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
        <HealHistory />
        
        {/* KPIs — Load Ring + Stats */}
        <div className="flex gap-4 items-center">
          <LoadRing rate={loadRate} />
          
          {/* Quality Grade Halo */}
          <div className="relative group mx-2">
             <div className={`absolute inset-0 blur-3xl opacity-20 transition-all duration-1000 rounded-full ${runGrade.color.replace('text-', 'bg-')}`} />
             <div className={`relative w-20 h-20 rounded-2xl border flex flex-col items-center justify-center bg-black/40 backdrop-blur-xl transition-all shadow-2xl ${runGrade.bg.replace('bg-opacity-10', 'bg-opacity-60')}`}>
                <span className={`text-3xl font-black italic tracking-tighter ${runGrade.color}`}>{runGrade.g}</span>
                <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest mt-1">Grade</span>
             </div>
          </div>

          <div className="flex-1 grid grid-cols-2 gap-2">
            <MetricCard label="Lignes source"  value={sourceRows.toLocaleString()}      color="info" />
            <MetricCard label="Faits insérés"  value={totalInserted.toLocaleString()}   color="success" />
            <MetricCard
              label="Rejetées"
              value={totalRejected.toLocaleString()}
              sub={totalRejected > 0 ? 'Vérifier logs' : 'Aucun'}
              color={totalRejected === 0 ? 'default' : 'error'}
            />
            <MetricCard
              label="Dimensions"
              value={Object.keys(dimMetrics).length}
              color="info"
            />
          </div>
        </div>

        {/* Neural Dashboard Dashboard (Visualisations IA) */}
        {visualizations.length > 0 && <ExecutiveSummary content={executiveSummary} visualizations={visualizations} />}

        {/* Performance Profiler (Nouveau v4.0) */}
        {Object.keys(nodeDurations).length > 0 && (
          <div className="rounded-[32px] p-8 border border-white/[0.05] bg-white/[0.02] space-y-6">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <Clock size={20} className="text-amber-400" />
                  </div>
                  <div>
                    <h4 className="text-[12px] font-black tracking-widest text-white uppercase italic">Agent Performance Profiler</h4>
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-[0.2em] mt-1">Node Execution Latency (seconds)</p>
                  </div>
               </div>
               <div className="text-[10px] font-mono text-zinc-400 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                  Total Latency: {Object.values(nodeDurations).reduce((a,b) => a+b, 0).toFixed(2)}s
               </div>
            </div>

            <div className="space-y-3">
               {Object.entries(nodeDurations).sort((a,b) => b[1] - a[1]).map(([node, duration]) => {
                  const maxDur = Math.max(...Object.values(nodeDurations), 1);
                  const pct = (duration / maxDur) * 100;
                  return (
                    <div key={node} className="space-y-1.5">
                       <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter">
                          <span className="text-zinc-400 italic">{node.replace(/_/g, ' ')}</span>
                          <span className="text-amber-400">{duration}s</span>
                       </div>
                       <div className="h-1.5 w-full bg-white/[0.03] rounded-full overflow-hidden border border-white/5">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            className="h-full bg-gradient-to-r from-amber-600 to-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.3)]"
                          />
                       </div>
                    </div>
                  )
               })}
            </div>
          </div>
        )}

        {/* Détail dimensions */}
        {Object.keys(dimMetrics).length > 0 && (
          <div className="rounded-2xl border border-white/[0.06] overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="px-5 py-3 border-b border-white/[0.04]">
              <div className="flex items-center gap-2">
                <Layers size={12} className="text-indigo-400" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Dimensions chargées</span>
              </div>
            </div>
            <div className="px-5 py-2">
              {Object.entries(dimMetrics).map(([name, m]) => (
                <DimRow key={name} name={name} metrics={m} />
              ))}
            </div>
          </div>
        )}

        {/* Qualité du run */}
        <div className="rounded-2xl border border-white/[0.06] p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={12} className="text-slate-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Évaluation du run</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full shrink-0 ${loadRate >= 90 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="text-[12px] text-slate-300">
                {loadRate >= 90 ? 'Taux de chargement excellent' : `Taux de chargement acceptable (${loadRate}%)`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full shrink-0 ${totalRejected === 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span className="text-[12px] text-slate-300">
                {totalRejected === 0 ? 'Aucun rejet — données propres' : `${totalRejected} ligne(s) rejetée(s) — vérifier les contraintes`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full shrink-0 ${Object.keys(dimMetrics).length > 0 ? 'bg-emerald-500' : 'bg-slate-600'}`} />
              <span className="text-[12px] text-slate-300">
                {Object.keys(dimMetrics).length > 0
                  ? `${Object.keys(dimMetrics).length} dimension(s) peuplée(s)`
                  : 'Aucune dimension chargée'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
