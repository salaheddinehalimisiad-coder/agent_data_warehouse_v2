// src/components/DataQualityPanel.jsx — Strategic Integrity Dashboard (V3 Premium)
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, ShieldAlert, ShieldX, ChevronDown, 
  ChevronRight, AlertTriangle, Activity, Target,
  Filter, BarChart3, Info, Sparkles, Download
} from 'lucide-react';
import { usePipelineStore } from '../store/pipelineStore';

function ScoreRing({ score }) {
  const radius = 32;
  const circ   = 2 * Math.PI * radius;
  const pct    = Math.max(0, Math.min(100, score));
  const dash   = (pct / 100) * circ;

  const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';
  const glow  = pct >= 80 ? 'rgba(16,185,129,0.2)' : pct >= 60 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)';

  return (
    <div className="relative flex flex-col items-center justify-center p-2 group">
      <svg width="84" height="84" viewBox="0 0 84 84" className="filter drop-shadow-lg">
        <circle cx="42" cy="42" r={radius} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="6" />
        <motion.circle
          cx="42" cy="42" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 42 42)"
          initial={{ strokeDasharray: `0 ${circ}` }}
          animate={{ strokeDasharray: `${dash} ${circ}` }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 8px ${glow})` }}
        />
        <text x="42" y="38" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="16" fontWeight="900" fontFamily="monospace italic">
          {Math.round(pct)}
        </text>
        <text x="42" y="52" dominantBaseline="middle" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="8" fontWeight="bold" fontFamily="monospace">
          SCORE
        </text>
      </svg>
    </div>
  );
}

function SeverityBadge({ severity }) {
  const styles = {
    error:   'bg-rose-500/10 border-rose-500/20 text-rose-400 shadow-rose-500/10',
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400 shadow-amber-500/10',
    info:    'bg-blue-500/10 border-blue-500/20 text-blue-400 shadow-blue-500/10',
  };
  const cls = styles[severity] || styles.info;
  return (
    <span className={`text-[8px] font-black font-mono px-2 py-1 rounded-full border shadow-sm tracking-wider uppercase ${cls}`}>
       {severity}
    </span>
  );
}

function AlertCard({ alert }) {
  return (
    <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl group hover:bg-white/[0.04] hover:border-white/10 transition-all">
       <div className="flex items-start gap-4 min-w-0">
          <div className="mt-1">
             <SeverityBadge severity={alert.severity} />
          </div>
          <div className="min-w-0">
             <h5 className="text-[11px] font-black text-white italic truncate">{alert.column.toUpperCase()}</h5>
             <p className="text-[10px] text-slate-500 mt-1 italic leading-relaxed">{alert.detail}</p>
          </div>
       </div>
       <div className="text-right shrink-0 ml-4">
          <div className="p-1 px-2 rounded-lg bg-black border border-white/5 text-[9px] font-black text-slate-600 uppercase tracking-widest font-mono">
             {alert.table}
          </div>
       </div>
    </div>
  );
}

function TableQualityItem({ tableName, tableReport }) {
  const [expanded, setExpanded] = useState(false);
  const score   = tableReport?.table_score ?? 100;
  const columns = tableReport?.columns ?? [];
  
  const scoreColor = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-rose-400';

  return (
    <div className="rounded-3xl border border-white/[0.06] bg-white/[0.01] overflow-hidden transition-all hover:border-white/10">
       <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-all">
          <div className="flex items-center gap-4">
             <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-500">
                <BarChart3 size={14} />
             </div>
             <div className="text-left">
                <h6 className="text-[11px] font-black text-white italic tracking-tighter uppercase">{tableName}</h6>
                <p className="text-[9px] text-slate-600 font-black tracking-widest uppercase mt-0.5">{tableReport?.row_count?.toLocaleString() || 0} DATA POINTS</p>
             </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex flex-col items-end">
                <span className={`text-xs font-black font-mono italic ${scoreColor}`}>{Math.round(score)}%</span>
                <span className="text-[7px] text-slate-800 font-black tracking-[0.2em] uppercase">Integrity</span>
             </div>
             <div className={`p-1 rounded-lg transition-transform ${expanded ? 'rotate-180 bg-white/5' : ''}`}>
                <ChevronDown size={14} className="text-slate-600" />
             </div>
          </div>
       </button>

       <AnimatePresence>
          {expanded && (
             <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-white/[0.04] bg-black/20">
                <div className="p-4 space-y-2">
                   {columns.map(col => (
                      <div key={col.column} className="flex items-center justify-between p-2.5 rounded-xl border border-transparent hover:border-white/5 transition-all">
                         <div className="flex items-center gap-3">
                            <span className="text-[11px] font-bold text-slate-400 font-mono italic">{col.column}</span>
                            {col.issues?.length > 0 && <AlertTriangle size={10} className="text-amber-500 animate-pulse" />}
                         </div>
                         <div className="flex items-center gap-4 font-mono">
                            {col.null_pct > 0 && <span className="text-[9px] text-slate-600">{col.null_pct.toFixed(2)}% NULL</span>}
                            <span className={`text-[10px] font-black px-2 py-0.5 border rounded-lg ${col.score >= 80 ? 'text-emerald-400 border-emerald-500/20' : 'text-amber-400 border-amber-500/20'}`}>{Math.round(col.score)}</span>
                         </div>
                      </div>
                   ))}
                </div>
             </motion.div>
          )}
       </AnimatePresence>
    </div>
  );
}

export default function DataQualityPanel() {
  const { dqReport, dqScore, dqAlerts, pipelineStatus, sessionId, authToken } = usePipelineStore();
  const [isActing, setIsActing] = useState(false);

  const handleDownloadCsv = () => {
    if (!dqReport || !dqReport.tables) return;
    let csv = "Table,Column,Type,NullPct,NUnique,Score,Issues\n";
    Object.entries(dqReport.tables).forEach(([tname, tbl]) => {
      tbl.columns?.forEach(c => {
         const issuesStr = c.issues?.map(i => i.rule).join(';') || 'None';
         csv += `"${tname}","${c.column}","${c.dtype}",${c.null_pct},${c.nunique},${c.score},"${issuesStr}"\n`;
      });
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dq_report_${sessionId?.substring(0,8) || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDQDecision = async (validated) => {
    setIsActing(true);
    try {
      await fetch('/api/validate-dq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ session_id: sessionId, validated }),
      });
    } catch (e) {
      console.error('[DQ Panel] validate-dq error:', e);
    } finally {
      setIsActing(false);
    }
  };

  const isDQBlocked = pipelineStatus === 'awaiting_dq_review';
  const [tab, setTab] = useState('overview');

  const hasReport = !!dqReport;

  if (!hasReport) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-10 text-center">
         <div className="w-16 h-16 rounded-3xl bg-white/[0.03] border border-white/5 flex items-center justify-center mb-6 relative">
            <div className="absolute inset-0 bg-white/5 blur-2xl rounded-full" />
            <ShieldCheck size={28} className="text-slate-700 opacity-50" />
         </div>
         <h4 className="text-sm font-black text-white italic tracking-tighter uppercase mb-2">Neutral Integrity Zone</h4>
         <p className="text-[10px] text-slate-600 font-medium leading-relaxed max-w-[200px] uppercase tracking-[0.1em]">Awaiting ingestion results to initialize the quality matrix.</p>
      </div>
    );
  }

  const globalScore = dqReport.global_score ?? dqScore ?? 100;
  const tables      = dqReport.tables ?? {};
  const recs        = dqReport.recommendations ?? [];
  const errorCount  = dqAlerts?.filter(a => a.severity === 'error').length ?? 0;
  const warnCount   = dqAlerts?.filter(a => a.severity === 'warning').length ?? 0;

  return (
    <div className="flex flex-col h-full bg-black/20 backdrop-blur-3xl overflow-hidden">
      
      {/* Strategic Header */}
      <div className="p-6 pb-2 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center justify-between mb-8">
             <h3 className="text-lg font-black text-white italic tracking-tighter uppercase underline decoration-emerald-500/50 underline-offset-8 decoration-4">Integrity Command</h3>
             <div className="flex gap-2">
                 <button onClick={handleDownloadCsv} className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-400 border border-white/10 text-slate-500 transition-all text-[9.5px] flex items-center font-black uppercase tracking-wider gap-1.5 shadow-sm">
                    <Download size={13} /> EXPORT
                 </button>
                 <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-500">
                    <Target size={18} />
                 </div>
             </div>
          </div>

          <div className="flex items-center gap-1.5 p-1.5 bg-white/[0.03] rounded-2xl border border-white/[0.08]">
             {[
                { id: 'overview', label: 'ANALYTICS', icon: Activity },
                { id: 'alerts',   label: `DETECTION (${dqAlerts?.length || 0})`, icon: Filter },
                { id: 'tables',   label: 'MATRIX', icon: BarChart3 }
             ].map(t => (
                <button
                  key={t.id} onClick={() => setTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${
                    tab === t.id ? 'bg-white text-black shadow-lg shadow-white/10' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                   <t.icon size={11} className={tab === t.id ? 'text-black' : 'text-slate-600'} />
                   {t.label}
                </button>
             ))}
          </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
         <AnimatePresence mode="wait">
            
            {tab === 'overview' && (
               <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                  {/* Global Score HUD */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center bg-indigo-500/5 border border-indigo-500/10 rounded-[32px] p-6 shadow-inner">
                     <ScoreRing score={globalScore} />
                     <div className="space-y-4">
                        <div className="flex items-center justify-between group">
                           <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fatal Errors</span>
                           </div>
                           <span className="text-xl font-black text-white italic group-hover:text-rose-400 transition-colors">{errorCount}</span>
                        </div>
                        <div className="flex items-center justify-between group">
                           <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Warnings</span>
                           </div>
                           <span className="text-xl font-black text-white italic group-hover:text-amber-400 transition-colors">{warnCount}</span>
                        </div>
                     </div>
                  </div>

                  {/* Recommendations */}
                  <div className="space-y-4">
                     <div className="flex items-center gap-3 px-2">
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Neural Recs</span>
                        <div className="h-px flex-1 bg-white/[0.04]" />
                     </div>
                     <div className="space-y-2.5">
                        {recs.map((r, i) => (
                           <div key={i} className="flex gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] group hover:border-indigo-500/20 transition-all shadow-sm">
                              <Sparkles size={14} className="text-indigo-500 shrink-0 mt-1 opacity-40 group-hover:opacity-100" />
                              <p className="text-[11.5px] text-slate-400 font-medium italic leading-relaxed group-hover:text-slate-200">{r}</p>
                           </div>
                        ))}
                     </div>
                  </div>
               </motion.div>
            )}

            {tab === 'alerts' && (
               <motion.div key="alerts" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
                  {dqAlerts?.length > 0 ? (
                     dqAlerts.map((a, i) => <AlertCard key={i} alert={a} />)
                  ) : (
                     <div className="h-60 flex flex-col items-center justify-center p-10 bg-emerald-500/5 rounded-[40px] border border-emerald-500/10 text-center">
                        <ShieldCheck size={32} className="text-emerald-500/40 mb-4" />
                        <h5 className="text-[11px] font-black text-white uppercase tracking-[0.2em] italic">Absolute Integrity</h5>
                        <p className="text-[9px] text-slate-600 mt-1 uppercase tracking-tighter">Zero protocol violations detected in source.</p>
                     </div>
                  )}
               </motion.div>
            )}

            {tab === 'tables' && (
               <motion.div key="tables" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3">
                  {Object.entries(tables).map(([name, rep]) => (
                     <TableQualityItem key={name} tableName={name} tableReport={rep} />
                  ))}
               </motion.div>
            )}

         </AnimatePresence>
      </div>

      {/* Footer System HUD */}
      <div className="p-6 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
             <span className="text-[9px] font-black text-slate-700 uppercase tracking-[0.2em]">Live Integrity Monitoring</span>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-black text-indigo-400/60 uppercase tracking-widest font-mono italic">
             V4.0 ARCHITECT PRO
          </div>
      </div>
        {isDQBlocked && (
          <div className="shrink-0 px-6 py-4 border-t border-rose-500/20 bg-rose-500/5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-black text-rose-300 uppercase tracking-wider">⚠️ Score DQ insuffisant — décision requise</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleDQDecision(false)}
                disabled={isActing}
                className="flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider border border-rose-500/30 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition-all disabled:opacity-40"
              >
                Abandonner le pipeline
              </button>
              <button
                onClick={() => handleDQDecision(true)}
                disabled={isActing}
                className="flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider border border-amber-500/30 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 transition-all disabled:opacity-40"
              >
                {isActing ? 'En cours...' : 'Continuer malgré tout'}
              </button>
            </div>
          </div>
        )}
    </div>
  );
}
