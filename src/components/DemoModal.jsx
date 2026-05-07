// src/components/DemoModal.jsx — Real App Demo
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Search, Waves, BrainCircuit, ShieldCheck, UserCheck, MessageSquare,
  Settings2, DownloadCloud, RefreshCw, UploadCloud, CheckCircle2, Clock,
  AlertCircle, Activity, Database, Zap, Terminal, ChevronRight, ChevronLeft,
  Play, Home, Table2, BarChart3, Layers, FlaskConical, Map, Sparkles,
  GitMerge, TrendingUp, Lock, Star, ArrowRight, Loader2, Eye, Edit3
} from 'lucide-react';

/* ─── Tour steps ─── */
const TOUR_STEPS = [
  {
    view: 'pipeline',
    title: 'Pipeline ETL Autonome',
    desc: 'Visualisez en temps reel le flux de donnees de l extraction a l analyse. Chaque etape est executee par un agent IA dedie.',
    highlight: 'pipeline-area',
  },
  {
    view: 'explorer',
    title: 'Data Explorer',
    desc: 'Explorez vos sources de donnees en un clic. SQL Server, PostgreSQL, MySQL, SQLite, CSV, Excel — tout est supporte.',
    highlight: 'main-area',
  },
  {
    view: 'logical_model',
    title: 'Modele Logique IA',
    desc: 'L IA genere automatiquement le schema dimensionnel (Etoile ou Flocon) adapte a vos donnees. Validation Critic integree.',
    highlight: 'main-area',
  },
  {
    view: 'schema',
    title: 'Schema Physique',
    desc: 'Le DDL SQL est genere et optimise. Index, partitions, contraintes — tout est pret pour la production.',
    highlight: 'main-area',
  },
  {
    view: 'metrics',
    title: 'Metrics & Qualite',
    desc: 'Suivez le Data Quality Score en temps reel. Detection d anomalies, profilage automatique, alerting.',
    highlight: 'main-area',
  },
  {
    view: 'query',
    title: 'Query Generator',
    desc: 'Generez des requetes SQL complexes par simple conversation en langage naturel. Powered by LLM.',
    highlight: 'main-area',
  },
  {
    view: 'olap',
    title: 'OLAP Cube Explorer',
    desc: 'Naviguez dans vos cubes OLAP avec drill-down, roll-up, slice et dice. Exportez vers Excel ou Power BI.',
    highlight: 'main-area',
  },
];

/* ─── Pipeline stages (same as PipelineCanvas) ─── */
const PIPELINE_STAGES = [
  { id: 'ingestion',  label: 'Source Audit',      subtitle: 'Schema discovery',       icon: Search,       color: '#3b82f6', agents: ['explorer'] },
  { id: 'drift',     label: 'Drift Detection',   subtitle: 'Schema evolution',       icon: Waves,        color: '#06b6d4', agents: ['drift_detector'] },
  { id: 'modeling',  label: 'Schema Modeling',   subtitle: 'Dimensional design',     icon: BrainCircuit, color: '#a855f7', agents: ['modeler','critic'] },
  { id: 'validation',label: 'Human Review',      subtitle: 'HITL approval',          icon: UserCheck,    color: '#f59e0b', agents: ['human_review'] },
  { id: 'etl_gen',   label: 'ETL Blueprint',     subtitle: 'Code generation',        icon: Settings2,    color: '#10b981', agents: ['etl_tsql_generator'] },
  { id: 'etl_extract',label:'Extract',           subtitle: 'Data ingestion',         icon: DownloadCloud,color: '#06b6d4', agents: ['etl_extractor'] },
  { id: 'etl_transform',label:'Transform',       subtitle: 'SK Resolution',        icon: RefreshCw,    color: '#a855f7', agents: ['etl_transformer'] },
  { id: 'etl_load',  label: 'Load',              subtitle: 'Fact population',        icon: UploadCloud,  color: '#10b981', agents: ['etl_loader','healer'] },
  { id: 'lineage',   label: 'Lineage',           subtitle: 'Data tracking',          icon: GitMerge,     color: '#6366f1', agents: ['lineage_tracker'] },
];

/* ─── Nav items (same as App.jsx sidebar) ─── */
const NAV_GROUPS = [
  {
    label: 'Pipeline',
    items: [
      { id: 'pipeline',      icon: Home,         label: 'Pipeline Canvas' },
      { id: 'data_sources',  icon: Database,     label: 'Data Sources' },
      { id: 'logical_model', icon: BrainCircuit, label: 'Logical Model' },
      { id: 'schema',        icon: Table2,       label: 'Schema View' },
      { id: 'lineage',       icon: GitMerge,     label: 'Lineage' },
    ]
  },
  {
    label: 'Analytics',
    items: [
      { id: 'explorer',      icon: Search,       label: 'Data Explorer' },
      { id: 'query',         icon: FlaskConical, label: 'Query Generator' },
      { id: 'olap',          icon: Layers,       label: 'OLAP Cube' },
      { id: 'metrics',       icon: BarChart3,    label: 'Metrics' },
    ]
  },
];

/* ─── Demo data ─── */
const DEMO_TABLES = [
  { name: 'Fact_Sales', type: 'FACT', rows: '12.4M', cols: 28, status: 'ok' },
  { name: 'Dim_Date', type: 'DIM', rows: '15K', cols: 12, status: 'ok' },
  { name: 'Dim_Product', type: 'DIM', rows: '8.2K', cols: 18, status: 'ok' },
  { name: 'Dim_Customer', type: 'DIM', rows: '245K', cols: 22, status: 'ok' },
  { name: 'Dim_Store', type: 'DIM', rows: '420', cols: 14, status: 'ok' },
  { name: 'Fact_Inventory', type: 'FACT', rows: '3.1M', cols: 16, status: 'warning' },
];

const DEMO_QUERIES = [
  { text: 'Montre-moi les ventes par region et par mois en 2024', sql: 'SELECT r.Region, d.Month, SUM(s.Amount) FROM Fact_Sales s JOIN Dim_Region r ON s.Region_SK = r.Region_SK JOIN Dim_Date d ON s.Date_SK = d.Date_SK WHERE d.Year = 2024 GROUP BY r.Region, d.Month ORDER BY d.Month;' },
  { text: 'Quels sont les top 10 produits les plus vendus ?', sql: 'SELECT p.ProductName, SUM(s.Quantity) as TotalQty FROM Fact_Sales s JOIN Dim_Product p ON s.Product_SK = p.Product_SK GROUP BY p.ProductName ORDER BY TotalQty DESC LIMIT 10;' },
];

export default function DemoModal({ isOpen, onClose }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [activeNav, setActiveNav] = useState('pipeline');
  const [showTooltip, setShowTooltip] = useState(true);
  const [pipelineProgress, setPipelineProgress] = useState(78);
  const [animatedAgents, setAnimatedAgents] = useState({});

  const step = TOUR_STEPS[stepIndex];

  useEffect(() => {
    if (!isOpen) return;
    setStepIndex(0);
    setActiveNav('pipeline');
    setPipelineProgress(0);
    setAnimatedAgents({});
    const timer = setTimeout(() => setPipelineProgress(78), 800);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveNav(step.view);
    setShowTooltip(true);
    PIPELINE_STAGES.forEach((s, i) => {
      setTimeout(() => {
        setAnimatedAgents(prev => ({ ...prev, [s.id]: true }));
      }, i * 200);
    });
  }, [stepIndex, isOpen]);

  const nextStep = () => {
    if (stepIndex < TOUR_STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
    }
  };
  const prevStep = () => {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  };

  const renderMainContent = () => {
    switch (activeNav) {
      case 'pipeline':
        return <PipelineDemoView progress={pipelineProgress} animatedAgents={animatedAgents} />;
      case 'explorer':
        return <ExplorerDemoView />;
      case 'logical_model':
        return <LogicalModelDemoView />;
      case 'schema':
        return <SchemaDemoView />;
      case 'metrics':
        return <MetricsDemoView />;
      case 'query':
        return <QueryDemoView />;
      case 'olap':
        return <OlapDemoView />;
      default:
        return <PipelineDemoView progress={pipelineProgress} animatedAgents={animatedAgents} />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-3 md:p-6"
          style={{ background: 'rgba(15,23,42,0.88)', backdropFilter: 'blur(12px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 30, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-[1200px] h-[85vh] rounded-[24px] border overflow-hidden flex flex-col shadow-2xl"
            style={{ background: '#0a0d1a', borderColor: 'rgba(255,255,255,0.06)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* ── Fake App Header ── */}
            <div className="flex items-center px-4 h-[48px] shrink-0 border-b" style={{ background: 'rgba(10,13,26,0.95)', borderColor: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)' }}>
              <div className="flex items-center gap-2 mr-4">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#3d6ae8,#6366f1)' }}>
                  <Sparkles size={14} className="text-white" />
                </div>
                <span className="text-[13px] font-bold text-white tracking-tight">Agent <span style={{ background:'linear-gradient(135deg,#3d6ae8,#7aa3ff)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>DW</span></span>
              </div>
              <div className="w-px h-5 mr-3" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <div className="flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Running
              </div>
              <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.04)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.06)' }}>DQ 94%</span>
              <div className="ml-auto flex items-center gap-2">
                <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors" style={{ color: '#64748b' }}><Terminal size={14} /></button>
                <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors" style={{ color: '#64748b' }}><Zap size={14} /></button>
                <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-500/10 transition-colors text-red-400"><X size={16} /></button>
              </div>
            </div>

            {/* ── Body ── */}
            <div className="flex flex-1 overflow-hidden">
              {/* ── Sidebar ── */}
              <div className="w-[220px] shrink-0 border-r overflow-y-auto py-3 hidden md:block" style={{ background: 'rgba(10,13,26,0.8)', borderColor: 'rgba(255,255,255,0.06)' }}>
                {NAV_GROUPS.map(group => (
                  <div key={group.label} className="mb-4">
                    <div className="px-4 py-2 text-[9px] font-black uppercase tracking-[0.15em]" style={{ color: '#475569' }}>{group.label}</div>
                    {group.items.map(item => {
                      const Icon = item.icon;
                      const active = activeNav === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => { setActiveNav(item.id); setShowTooltip(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-[12px] font-semibold transition-all"
                          style={{
                            color: active ? '#e2e8f0' : '#64748b',
                            background: active ? 'rgba(61,106,232,0.12)' : 'transparent',
                            borderLeft: active ? '3px solid #3d6ae8' : '3px solid transparent',
                          }}
                        >
                          <Icon size={15} style={{ opacity: active ? 1 : 0.6 }} />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                ))}
                <div className="mx-3 mt-4 p-3 rounded-xl border" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }}>
                  <div className="text-[9px] font-black uppercase tracking-wider mb-2" style={{ color: '#475569' }}>Status</div>
                  <div className="space-y-2">
                    {[
                      { label: 'Pipeline', val: 'Active', color: '#34d399' },
                      { label: 'Sources', val: '3/5', color: '#60a5fa' },
                      { label: 'Agents', val: '9/9', color: '#a78bfa' },
                      { label: 'Quality', val: '94%', color: '#fbbf24' },
                    ].map(s => (
                      <div key={s.label} className="flex justify-between text-[10px]">
                        <span style={{ color: '#64748b' }}>{s.label}</span>
                        <span className="font-bold" style={{ color: s.color }}>{s.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Main Area ── */}
              <div id="main-area" className="flex-1 overflow-y-auto relative" style={{ background: '#060810' }}>
                {renderMainContent()}
                <AnimatePresence>
                  {showTooltip && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-lg px-6"
                    >
                      <div className="rounded-2xl border p-5 shadow-2xl" style={{ background: 'rgba(17,21,37,0.97)', borderColor: 'rgba(61,106,232,0.25)', backdropFilter: 'blur(20px)' }}>
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg,#3d6ae8,#6366f1)' }}>
                            <span className="text-white font-black text-sm">{stepIndex + 1}</span>
                          </div>
                          <div className="flex-1">
                            <h4 className="text-white font-bold text-base mb-1">{step.title}</h4>
                            <p className="text-[13px] leading-relaxed" style={{ color: '#94a3b8' }}>{step.desc}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-5 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                          <div className="flex gap-1.5">
                            {TOUR_STEPS.map((_, i) => (
                              <div key={i} className="h-1.5 rounded-full transition-all" style={{
                                width: i === stepIndex ? 24 : 8,
                                background: i <= stepIndex ? '#3d6ae8' : 'rgba(255,255,255,0.1)'
                              }} />
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={prevStep} disabled={stepIndex === 0} className="px-4 py-2 rounded-xl text-[12px] font-bold border disabled:opacity-30 hover:bg-white/5 transition-all" style={{ color: '#94a3b8', borderColor: 'rgba(255,255,255,0.08)' }}>
                              <ChevronLeft size={14} className="inline mr-1" />Precedent
                            </button>
                            <button onClick={nextStep} className="px-5 py-2 rounded-xl text-[12px] font-bold text-white hover:opacity-90 transition-all flex items-center gap-2" style={{ background: 'linear-gradient(135deg,#3d6ae8,#6366f1)' }}>
                              {stepIndex === TOUR_STEPS.length - 1 ? 'Terminer' : 'Suivant'}
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════════════════
   Sub-views
   ═══════════════════════════════════════════════════════════ */

function PipelineDemoView({ progress, animatedAgents }) {
  return (
    <div id="pipeline-area" className="p-6 md:p-10 min-h-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Pipeline ETL Autonome</h2>
          <p className="text-[13px]" style={{ color: '#64748b' }}>Execution en temps reel — Session #dw-2026-0512</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl border text-[12px] font-bold flex items-center gap-2" style={{ background: 'rgba(16,185,129,0.08)', color: '#34d399', borderColor: 'rgba(16,185,129,0.15)' }}>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            En cours — {progress}%
          </div>
          <button className="px-4 py-2 rounded-xl text-white text-[12px] font-bold" style={{ background: 'linear-gradient(135deg,#3d6ae8,#6366f1)' }}>
            <Play size={14} className="inline mr-1" /> Relancer
          </button>
        </div>
      </div>
      <div className="w-full h-2 rounded-full mb-10 overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 2, ease: 'easeOut' }} className="h-full rounded-full" style={{ background: 'linear-gradient(90deg,#3d6ae8,#10b981)' }} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {PIPELINE_STAGES.map((stage, i) => {
          const Icon = stage.icon;
          const isActive = i <= 5;
          const isDone = i < 5;
          return (
            <motion.div key={stage.id} initial={{ opacity: 0, y: 20 }} animate={animatedAgents[stage.id] ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }} transition={{ duration: 0.4 }}
              className="relative rounded-2xl border p-5 transition-all hover:border-white/10" style={{ background: isActive ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)', borderColor: isActive ? `${stage.color}30` : 'rgba(255,255,255,0.04)' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${stage.color}15` }}>
                  <Icon size={18} style={{ color: stage.color }} />
                </div>
                {isDone ? <CheckCircle2 size={16} className="text-emerald-400" /> : isActive ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}><Loader2 size={16} style={{ color: stage.color }} /></motion.div> : <Clock size={16} style={{ color: '#475569' }} />}
              </div>
              <div className="text-[13px] font-bold text-white mb-1">{stage.label}</div>
              <div className="text-[11px]" style={{ color: '#475569' }}>{stage.subtitle}</div>
              {isActive && (
                <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <motion.div animate={{ width: isDone ? '100%' : ['0%', '70%', '40%', '90%'] }} transition={{ duration: isDone ? 0.5 : 3, repeat: isDone ? 0 : Infinity }} className="h-full rounded-full" style={{ background: stage.color }} />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
      <div className="rounded-2xl border p-6" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="text-[11px] font-black uppercase tracking-[0.15em] mb-4" style={{ color: '#475569' }}>Agents Actifs</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { name: 'Explorer Agent', status: 'done', time: '2.4s', icon: Search },
            { name: 'Drift Detector', status: 'done', time: '0.8s', icon: Waves },
            { name: 'Modeler Agent', status: 'done', time: '4.1s', icon: BrainCircuit },
            { name: 'Critic Agent', status: 'done', time: '1.2s', icon: ShieldCheck },
            { name: 'ETL Generator', status: 'running', time: '...', icon: Settings2 },
            { name: 'ETL Extractor', status: 'waiting', time: '-', icon: DownloadCloud },
            { name: 'ETL Transformer', status: 'waiting', time: '-', icon: RefreshCw },
            { name: 'Healer Agent', status: 'waiting', time: '-', icon: Zap },
          ].map((agent, i) => {
            const Icon = agent.icon;
            return (
              <motion.div key={agent.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                className="flex items-center gap-3 p-3 rounded-xl border" style={{ background: agent.status === 'running' ? 'rgba(61,106,232,0.06)' : 'rgba(255,255,255,0.02)', borderColor: agent.status === 'running' ? 'rgba(61,106,232,0.15)' : 'rgba(255,255,255,0.04)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <Icon size={14} style={{ color: agent.status === 'done' ? '#34d399' : agent.status === 'running' ? '#3d6ae8' : '#475569' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-white truncate">{agent.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: agent.status === 'done' ? '#34d399' : agent.status === 'running' ? '#3d6ae8' : '#475569' }} />
                    <span className="text-[10px] font-medium" style={{ color: '#64748b' }}>{agent.status === 'running' ? 'En cours' : agent.status === 'done' ? agent.time : 'En attente'}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ExplorerDemoView() {
  return (
    <div className="p-6 md:p-10 min-h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Data Explorer</h2>
          <p className="text-[13px]" style={{ color: '#64748b' }}>Sources connectees : SQL Server · PostgreSQL · MySQL</p>
        </div>
        <button className="px-4 py-2 rounded-xl text-white text-[12px] font-bold flex items-center gap-2" style={{ background: 'linear-gradient(135deg,#3d6ae8,#6366f1)' }}>
          <Database size={14} /> Nouvelle Source
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Tables decouvertes', val: '47', change: '+12%', icon: Table2, color: '#3d6ae8' },
          { label: 'Colonnes analysees', val: '312', change: '+28%', icon: Activity, color: '#a855f7' },
          { label: 'FK detectees', val: '28', change: '+5', icon: GitMerge, color: '#10b981' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.15 }}
              className="rounded-2xl border p-5" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${stat.color}15` }}><Icon size={18} style={{ color: stat.color }} /></div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${stat.color}15`, color: stat.color }}>{stat.change}</span>
              </div>
              <div className="text-2xl font-black text-white mb-1">{stat.val}</div>
              <div className="text-[11px] font-medium" style={{ color: '#475569' }}>{stat.label}</div>
            </motion.div>
          );
        })}
      </div>
      <div className="rounded-2xl border overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <span className="text-[12px] font-bold text-white">Tables detectees</span>
          <div className="flex gap-2">
            <span className="text-[10px] font-bold px-3 py-1.5 rounded-lg border" style={{ background: 'rgba(61,106,232,0.08)', color: '#7aa3ff', borderColor: 'rgba(61,106,232,0.15)' }}>FACT</span>
            <span className="text-[10px] font-bold px-3 py-1.5 rounded-lg border" style={{ background: 'rgba(168,85,247,0.08)', color: '#c4b5fd', borderColor: 'rgba(168,85,247,0.15)' }}>DIM</span>
          </div>
        </div>
        <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
          {DEMO_TABLES.map((table, i) => (
            <motion.div key={table.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
              className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: table.type === 'FACT' ? 'rgba(61,106,232,0.1)' : 'rgba(168,85,247,0.1)' }}>
                  <Table2 size={14} style={{ color: table.type === 'FACT' ? '#7aa3ff' : '#c4b5fd' }} />
                </div>
                <div>
                  <div className="text-[13px] font-bold text-white">{table.name}</div>
                  <div className="text-[10px]" style={{ color: '#475569' }}>{table.cols} colonnes · {table.rows} lignes</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-md" style={{ background: table.type === 'FACT' ? 'rgba(61,106,232,0.1)' : 'rgba(168,85,247,0.1)', color: table.type === 'FACT' ? '#7aa3ff' : '#c4b5fd' }}>{table.type}</span>
                {table.status === 'ok' ? <CheckCircle2 size={14} className="text-emerald-400" /> : <AlertCircle size={14} className="text-amber-400" />}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LogicalModelDemoView() {
  return (
    <div className="p-6 md:p-10 min-h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Modele Logique</h2>
          <p className="text-[13px]" style={{ color: '#64748b' }}>Schema en Etoile genere par l IA · Score Critic : 98/100</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 rounded-xl text-[12px] font-bold border flex items-center gap-2" style={{ color: '#94a3b8', borderColor: 'rgba(255,255,255,0.08)' }}><Eye size={14} /> Vue Etoile</button>
          <button className="px-4 py-2 rounded-xl text-[12px] font-bold border flex items-center gap-2" style={{ color: '#94a3b8', borderColor: 'rgba(255,255,255,0.08)' }}><Layers size={14} /> Vue Flocon</button>
        </div>
      </div>
      <div className="flex justify-center mb-8">
        <div className="relative">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 15 }}
            className="w-40 h-40 rounded-3xl border-2 flex flex-col items-center justify-center mx-auto relative z-10" style={{ background: 'rgba(61,106,232,0.08)', borderColor: '#3d6ae8', boxShadow: '0 0 40px rgba(61,106,232,0.15)' }}>
            <Table2 size={32} className="text-blue-400 mb-2" />
            <div className="text-[13px] font-bold text-white">Fact_Sales</div>
            <div className="text-[10px]" style={{ color: '#64748b' }}>12.4M rows · 28 cols</div>
          </motion.div>
          {[
            { name: 'Dim_Date', icon: Clock, color: '#a855f7', angle: -90 },
            { name: 'Dim_Product', icon: Layers, color: '#10b981', angle: -30 },
            { name: 'Dim_Customer', icon: UserCheck, color: '#f59e0b', angle: 30 },
            { name: 'Dim_Store', icon: Map, color: '#06b6d4', angle: 90 },
            { name: 'Dim_Region', icon: GitMerge, color: '#ec4899', angle: 150 },
            { name: 'Dim_Promotion', icon: Star, color: '#6366f1', angle: 210 },
          ].map((dim, i) => {
            const radius = 160;
            const rad = (dim.angle * Math.PI) / 180;
            const x = Math.cos(rad) * radius;
            const y = Math.sin(rad) * radius;
            const Icon = dim.icon;
            return (
              <motion.div key={dim.name} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1, x, y }} transition={{ delay: 0.3 + i * 0.15, type: 'spring', damping: 12 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-24 rounded-2xl border flex flex-col items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)', borderColor: `${dim.color}40` }}>
                <Icon size={18} style={{ color: dim.color }} className="mb-1.5" />
                <div className="text-[10px] font-bold text-white text-center px-1">{dim.name}</div>
              </motion.div>
            );
          })}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ transform: 'translate(-50%, -50%)', left: '50%', top: '50%' }}>
            {[-90, -30, 30, 90, 150, 210].map((angle, i) => {
              const radius = 120;
              const rad = (angle * Math.PI) / 180;
              const x2 = Math.cos(rad) * radius + 200;
              const y2 = Math.sin(rad) * radius + 200;
              return (
                <motion.line key={i} x1="200" y1="200" x2={x2} y2={y2} stroke="rgba(61,106,232,0.2)" strokeWidth="1.5" strokeDasharray="4 4"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.8 + i * 0.1, duration: 0.5 }} />
              );
            })}
          </svg>
        </div>
      </div>
      <div className="rounded-2xl border p-5" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-3 mb-4">
          <ShieldCheck size={18} className="text-amber-400" />
          <span className="text-[13px] font-bold text-white">Rapport Critic Agent</span>
          <span className="ml-auto text-[11px] font-bold px-3 py-1 rounded-full" style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399' }}>APPROVED — 98/100</span>
        </div>
        <div className="space-y-2">
          {[
            { check: true, text: 'Cles primaires valides sur toutes les dimensions' },
            { check: true, text: 'Contraintes FK coherentes (47 relations verifiees)' },
            { check: true, text: 'Index recommandes appliquees' },
            { check: false, text: 'Index manquant sur Dim_Date.Date_Key — CORRIGE' },
          ].map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.2 + i * 0.15 }}
              className="flex items-center gap-3 text-[12px]" style={{ color: item.check ? '#94a3b8' : '#fbbf24' }}>
              {item.check ? <CheckCircle2 size={14} className="text-emerald-400 shrink-0" /> : <AlertCircle size={14} className="text-amber-400 shrink-0" />}
              {item.text}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SchemaDemoView() {
  return (
    <div className="p-6 md:p-10 min-h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Schema Physique</h2>
          <p className="text-[13px]" style={{ color: '#64748b' }}>DDL SQL genere · Pret pour SQL Server / PostgreSQL</p>
        </div>
        <button className="px-4 py-2 rounded-xl text-white text-[12px] font-bold flex items-center gap-2" style={{ background: 'linear-gradient(135deg,#3d6ae8,#6366f1)' }}>
          <DownloadCloud size={14} /> Exporter DDL
        </button>
      </div>
      <div className="rounded-2xl border overflow-hidden font-mono text-[12px] leading-relaxed" style={{ background: '#0d1117', borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2 px-4 py-2 border-b" style={{ background: '#161b22', borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="w-3 h-3 rounded-full bg-red-400/80" /><div className="w-3 h-3 rounded-full bg-amber-400/80" /><div className="w-3 h-3 rounded-full bg-emerald-400/80" />
          <span className="ml-2 text-[11px]" style={{ color: '#475569' }}>Fact_Sales.sql</span>
        </div>
        <div className="p-5 overflow-x-auto">
          <pre style={{ color: '#c9d1d9' }}>
            <span style={{ color: '#ff7b72' }}>CREATE TABLE</span> <span style={{ color: '#79c0ff' }}>Fact_Sales</span> {'(\n'}
            {'  '}<span style={{ color: '#79c0ff' }}>Sales_SK</span> <span style={{ color: '#ff7b72' }}>INT</span> <span style={{ color: '#ff7b72' }}>IDENTITY</span>(<span style={{ color: '#79c0ff' }}>1</span>,<span style={{ color: '#79c0ff' }}>1</span>) <span style={{ color: '#ff7b72' }}>NOT NULL</span>,{'\n'}
            {'  '}<span style={{ color: '#79c0ff' }}>Date_SK</span> <span style={{ color: '#ff7b72' }}>INT</span> <span style={{ color: '#ff7b72' }}>NOT NULL</span>,{'\n'}
            {'  '}<span style={{ color: '#79c0ff' }}>Product_SK</span> <span style={{ color: '#ff7b72' }}>INT</span> <span style={{ color: '#ff7b72' }}>NOT NULL</span>,{'\n'}
            {'  '}<span style={{ color: '#79c0ff' }}>Customer_SK</span> <span style={{ color: '#ff7b72' }}>INT</span> <span style={{ color: '#ff7b72' }}>NOT NULL</span>,{'\n'}
            {'  '}<span style={{ color: '#79c0ff' }}>Store_SK</span> <span style={{ color: '#ff7b72' }}>INT</span> <span style={{ color: '#ff7b72' }}>NOT NULL</span>,{'\n'}
            {'  '}<span style={{ color: '#79c0ff' }}>Quantity</span> <span style={{ color: '#ff7b72' }}>INT</span> <span style={{ color: '#ff7b72' }}>NOT NULL</span>,{'\n'}
            {'  '}<span style={{ color: '#79c0ff' }}>UnitPrice</span> <span style={{ color: '#ff7b72' }}>DECIMAL</span>(<span style={{ color: '#79c0ff' }}>10</span>,<span style={{ color: '#79c0ff' }}>2</span>) <span style={{ color: '#ff7b72' }}>NOT NULL</span>,{'\n'}
            {'  '}<span style={{ color: '#79c0ff' }}>DiscountAmount</span> <span style={{ color: '#ff7b72' }}>DECIMAL</span>(<span style={{ color: '#79c0ff' }}>10</span>,<span style={{ color: '#79c0ff' }}>2</span>) <span style={{ color: '#ff7b72' }}>DEFAULT</span> <span style={{ color: '#79c0ff' }}>0</span>,{'\n'}
            {'  '}<span style={{ color: '#79c0ff' }}>SalesAmount</span> <span style={{ color: '#ff7b72' }}>DECIMAL</span>(<span style={{ color: '#79c0ff' }}>10</span>,<span style={{ color: '#79c0ff' }}>2</span>) <span style={{ color: '#ff7b72' }}>NOT NULL</span>,{'\n'}
            {'  '}<span style={{ color: '#ff7b72' }}>CONSTRAINT</span> <span style={{ color: '#79c0ff' }}>PK_Fact_Sales</span> <span style={{ color: '#ff7b72' }}>PRIMARY KEY</span> (<span style={{ color: '#79c0ff' }}>Sales_SK</span>),{'\n'}
            {'  '}<span style={{ color: '#ff7b72' }}>CONSTRAINT</span> <span style={{ color: '#79c0ff' }}>FK_Date</span> <span style={{ color: '#ff7b72' }}>FOREIGN KEY</span> (<span style={{ color: '#79c0ff' }}>Date_SK</span>) <span style={{ color: '#ff7b72' }}>REFERENCES</span> <span style={{ color: '#79c0ff' }}>Dim_Date</span>(<span style={{ color: '#79c0ff' }}>Date_SK</span>),{'\n'}
            {'  '}<span style={{ color: '#ff7b72' }}>CONSTRAINT</span> <span style={{ color: '#79c0ff' }}>FK_Product</span> <span style={{ color: '#ff7b72' }}>FOREIGN KEY</span> (<span style={{ color: '#79c0ff' }}>Product_SK</span>) <span style={{ color: '#ff7b72' }}>REFERENCES</span> <span style={{ color: '#79c0ff' }}>Dim_Product</span>(<span style={{ color: '#79c0ff' }}>Product_SK</span>){'\n'}
            );{'\n'}
            {'\n'}
            <span style={{ color: '#ff7b72' }}>CREATE INDEX</span> <span style={{ color: '#79c0ff' }}>IX_Fact_Sales_Date</span> <span style={{ color: '#ff7b72' }}>ON</span> <span style={{ color: '#79c0ff' }}>Fact_Sales</span>(<span style={{ color: '#79c0ff' }}>Date_SK</span>);{'\n'}
            <span style={{ color: '#ff7b72' }}>CREATE INDEX</span> <span style={{ color: '#79c0ff' }}>IX_Fact_Sales_Product</span> <span style={{ color: '#ff7b72' }}>ON</span> <span style={{ color: '#79c0ff' }}>Fact_Sales</span>(<span style={{ color: '#79c0ff' }}>Product_SK</span>);
          </pre>
        </div>
      </div>
    </div>
  );
}

function MetricsDemoView() {
  return (
    <div className="p-6 md:p-10 min-h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Metrics & Data Quality</h2>
          <p className="text-[13px]" style={{ color: '#64748b' }}>Surveillance en temps reel de la qualite des donnees</p>
        </div>
        <span className="px-4 py-2 rounded-xl text-[12px] font-bold flex items-center gap-2" style={{ background: 'rgba(16,185,129,0.08)', color: '#34d399', border: '1px solid rgba(16,185,129,0.15)' }}>
          <Activity size={14} /> DQ Score : 94%
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Completeness', val: '98%', color: '#34d399', bg: 'rgba(16,185,129,0.08)' },
          { label: 'Accuracy', val: '91%', color: '#fbbf24', bg: 'rgba(251,191,36,0.08)' },
          { label: 'Consistency', val: '96%', color: '#34d399', bg: 'rgba(16,185,129,0.08)' },
          { label: 'Timeliness', val: '89%', color: '#f87171', bg: 'rgba(248,113,113,0.08)' },
        ].map((m, i) => (
          <motion.div key={m.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12 }}
            className="rounded-2xl border p-5 text-center" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }}>
            <div className="text-2xl font-black mb-1" style={{ color: m.color }}>{m.val}</div>
            <div className="text-[11px] font-medium" style={{ color: '#475569' }}>{m.label}</div>
            <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <motion.div initial={{ width: 0 }} animate={{ width: m.val }} transition={{ delay: 0.5 + i * 0.2, duration: 1 }} className="h-full rounded-full" style={{ background: m.color }} />
            </div>
          </motion.div>
        ))}
      </div>
      <div className="rounded-2xl border p-5" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="text-[11px] font-black uppercase tracking-[0.15em] mb-4" style={{ color: '#475569' }}>Alertes Recentes</div>
        <div className="space-y-3">
          {[
            { type: 'warning', msg: 'Valeurs nulles detectees dans Dim_Customer.Email (2.3%)', time: '2 min' },
            { type: 'info', msg: 'Schema drift detecte : nouvelle colonne "Category_Level" dans Dim_Product', time: '15 min' },
            { type: 'success', msg: 'Auto-healing : 47 doublons fusionnes dans Dim_Customer', time: '1h' },
          ].map((alert, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 + i * 0.15 }}
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: alert.type === 'warning' ? 'rgba(251,191,36,0.04)' : alert.type === 'success' ? 'rgba(16,185,129,0.04)' : 'rgba(61,106,232,0.04)' }}>
              {alert.type === 'warning' ? <AlertCircle size={14} className="text-amber-400 shrink-0" /> :
               alert.type === 'success' ? <CheckCircle2 size={14} className="text-emerald-400 shrink-0" /> :
               <Activity size={14} className="text-blue-400 shrink-0" />}
              <div className="flex-1 text-[12px]" style={{ color: '#c9d1d9' }}>{alert.msg}</div>
              <span className="text-[10px] font-medium shrink-0" style={{ color: '#475569' }}>{alert.time}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QueryDemoView() {
  return (
    <div className="p-6 md:p-10 min-h-full">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-1">Query Generator</h2>
        <p className="text-[13px]" style={{ color: '#64748b' }}>Generez du SQL par langage naturel grace a l IA</p>
      </div>
      <div className="rounded-2xl border p-4 mb-4" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-3 mb-3">
          <Sparkles size={16} className="text-indigo-400" />
          <span className="text-[12px] font-bold text-white">Posez votre question en francais</span>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 rounded-xl border px-4 py-3 text-[13px] text-white" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
            Quels sont les top 10 produits les plus vendus en 2024 par region ?
          </div>
          <button className="px-5 py-3 rounded-xl text-white text-[12px] font-bold" style={{ background: 'linear-gradient(135deg,#3d6ae8,#6366f1)' }}>
            <Sparkles size={14} className="inline mr-1" /> Generer
          </button>
        </div>
      </div>
      <div className="space-y-4">
        {DEMO_QUERIES.map((q, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.3 }}
            className="rounded-2xl border overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }}>
            <div className="px-5 py-3 border-b flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.05)' }}>
              <div className="flex items-center gap-2">
                <MessageSquare size={14} style={{ color: '#64748b' }} />
                <span className="text-[12px] text-white">{q.text}</span>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 rounded-lg text-[10px] font-bold border flex items-center gap-1" style={{ color: '#94a3b8', borderColor: 'rgba(255,255,255,0.08)' }}><Eye size={12} /> Apercu</button>
                <button className="px-3 py-1.5 rounded-lg text-[10px] font-bold border flex items-center gap-1" style={{ color: '#94a3b8', borderColor: 'rgba(255,255,255,0.08)' }}><Edit3 size={12} /> Modifier</button>
              </div>
            </div>
            <div className="p-5 font-mono text-[12px] leading-relaxed overflow-x-auto" style={{ color: '#c9d1d9', background: '#0d1117' }}>
              <pre>{q.sql}</pre>
            </div>
            <div className="px-5 py-2 border-t flex items-center gap-4" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <span className="text-[10px] font-medium" style={{ color: '#475569' }}>~120ms execution</span>
              <span className="text-[10px] font-medium" style={{ color: '#475569' }}>42 rows returned</span>
              <button className="ml-auto text-[10px] font-bold flex items-center gap-1" style={{ color: '#3d6ae8' }}><ArrowRight size={12} /> Executer</button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function OlapDemoView() {
  return (
    <div className="p-6 md:p-10 min-h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">OLAP Cube Explorer</h2>
          <p className="text-[13px]" style={{ color: '#64748b' }}>Analyse multidimensionnelle · Cube : Sales_VCube_2024</p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-2 rounded-xl text-[11px] font-bold border" style={{ color: '#94a3b8', borderColor: 'rgba(255,255,255,0.08)' }}>Slice</button>
          <button className="px-3 py-2 rounded-xl text-[11px] font-bold border" style={{ color: '#94a3b8', borderColor: 'rgba(255,255,255,0.08)' }}>Dice</button>
          <button className="px-3 py-2 rounded-xl text-[11px] font-bold border" style={{ color: '#94a3b8', borderColor: 'rgba(255,255,255,0.08)' }}>Drill Down</button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Ventes', val: '2.4M DA', change: '+18%', icon: TrendingUp, color: '#34d399' },
          { label: 'Unites Vendues', val: '845K', change: '+12%', icon: BarChart3, color: '#60a5fa' },
          { label: 'Panier Moyen', val: '2,840 DA', change: '+5%', icon: Star, color: '#fbbf24' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12 }}
              className="rounded-2xl border p-5" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${stat.color}15` }}><Icon size={18} style={{ color: stat.color }} /></div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${stat.color}15`, color: stat.color }}>{stat.change}</span>
              </div>
              <div className="text-2xl font-black text-white mb-1">{stat.val}</div>
              <div className="text-[11px] font-medium" style={{ color: '#475569' }}>{stat.label}</div>
            </motion.div>
          );
        })}
      </div>
      <div className="rounded-2xl border overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <span className="text-[12px] font-bold text-white">Ventes par Region et Trimestre</span>
          <span className="text-[10px] font-medium" style={{ color: '#475569' }}>Cube : Sales_VCube_2024</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                <th className="text-left px-5 py-3 font-bold text-white border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>Region</th>
                <th className="text-right px-4 py-3 font-bold text-white border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>Q1 2024</th>
                <th className="text-right px-4 py-3 font-bold text-white border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>Q2 2024</th>
                <th className="text-right px-4 py-3 font-bold text-white border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>Q3 2024</th>
                <th className="text-right px-4 py-3 font-bold text-white border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>Q4 2024</th>
                <th className="text-right px-5 py-3 font-bold text-white border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {[
                { region: 'Alger', q1: '485K', q2: '520K', q3: '612K', q4: '704K', total: '2.32M' },
                { region: 'Oran', q1: '312K', q2: '348K', q3: '390K', q4: '456K', total: '1.51M' },
                { region: 'Constantine', q1: '198K', q2: '224K', q3: '256K', q4: '298K', total: '976K' },
                { region: 'Annaba', q1: '145K', q2: '168K', q3: '192K', q4: '228K', total: '733K' },
              ].map((row, i) => (
                <motion.tr key={row.region} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 + i * 0.1 }} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3 font-medium text-white border-b" style={{ borderColor: 'rgba(255,255,255,0.03)' }}>{row.region}</td>
                  <td className="text-right px-4 py-3 border-b" style={{ color: '#94a3b8', borderColor: 'rgba(255,255,255,0.03)' }}>{row.q1}</td>
                  <td className="text-right px-4 py-3 border-b" style={{ color: '#94a3b8', borderColor: 'rgba(255,255,255,0.03)' }}>{row.q2}</td>
                  <td className="text-right px-4 py-3 border-b" style={{ color: '#94a3b8', borderColor: 'rgba(255,255,255,0.03)' }}>{row.q3}</td>
                  <td className="text-right px-4 py-3 border-b" style={{ color: '#94a3b8', borderColor: 'rgba(255,255,255,0.03)' }}>{row.q4}</td>
                  <td className="text-right px-5 py-3 font-bold text-white border-b" style={{ borderColor: 'rgba(255,255,255,0.03)' }}>{row.total}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
