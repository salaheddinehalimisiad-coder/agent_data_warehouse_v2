// src/components/UseCaseFlow.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plug, Database, BrainCircuit, MessageSquare, Rocket, Workflow, Activity,
  Search, GitBranch, Shield, Sparkles, Bot, FileCode2, ServerCog, Zap,
  AlertTriangle, RefreshCcw, CheckCircle2, Eye, Layers, Cpu,
  Play, Pause, RotateCcw, ChevronRight, Wifi, FileSpreadsheet, FileCode,
  Boxes, Network, MonitorCheck, Wand2, ArrowDown
} from 'lucide-react';

const STAGES = [
  {
    n: 1,
    key: 'connect',
    title: 'Connexion multi-sources',
    short: 'Brancher n\'importe quelle donnée',
    icon: Plug,
    color: 'from-sky-500 to-cyan-500',
    accent: '#38BDF8',
    subAgents: ['Test Connection', 'Version Probe', 'Docker Bridge'],
    sources: [
      { label: 'SQL Server .bak', icon: Database },
      { label: 'SQL Server .sql', icon: FileCode },
      { label: 'SQL Server .bacpac', icon: ServerCog },
      { label: 'CSV', icon: FileSpreadsheet },
      { label: 'Excel', icon: FileSpreadsheet },
      { label: 'REST API', icon: Wifi },
      { label: 'SQLite', icon: Database },
    ],
    detail: {
      what: "L'utilisateur sélectionne sa source, fournit fichier ou identifiants. Une couche d'adaptateurs unifie tout en une représentation interne commune.",
      bullets: [
        "Préflight RESTORE HEADERONLY pour valider la version SQL Server du backup",
        "Auto-bridge Docker : si la version du .bak ≠ version cible, un conteneur SQL Server compatible est provisionné automatiquement (streaming NDJSON, cancel possible)",
        "Test connexion temps réel avant de lancer le pipeline",
      ],
      io: { in: 'Fichier / URL / credentials', out: 'Source standardisée' },
    },
  },
  {
    n: 2,
    key: 'analyze',
    title: 'Analyse agentique & modélisation virtuelle',
    short: 'Comprendre, profiler, modéliser',
    icon: BrainCircuit,
    color: 'from-indigo-500 to-violet-500',
    accent: '#8B5CF6',
    subAgents: ['Explorer', 'Modeler', 'Data Quality', 'Governance', 'CDC Watermark'],
    sources: [
      { label: 'Explorer Agent', icon: Search },
      { label: 'Modeler Agent', icon: Layers },
      { label: 'Data Quality', icon: Shield },
      { label: 'Governance / PII', icon: Eye },
      { label: 'CDC Watermark', icon: GitBranch },
    ],
    detail: {
      what: "Lecture seule des métadonnées (schémas, tables, colonnes), profilage qualité, détection PII, puis déduction d'un modèle dimensionnel Kimball (Faits + Dimensions + SCD Type 2).",
      bullets: [
        "Explorer scanne sans modifier la source",
        "Modeler infère faits/dimensions, hiérarchies, clés étrangères",
        "Data Quality Agent calcule un DQ score (alerte HITL si < 50)",
        "Governance Agent flagge les colonnes PII",
        "CDC Watermark décide full_load vs incrémental",
      ],
      io: { in: 'Métadonnées source', out: 'Modèle logique JSON + DDL T-SQL draft' },
    },
  },
  {
    n: 3,
    key: 'review',
    title: 'Conception itérative & Human-in-the-Loop',
    short: 'Chat, critique, validation',
    icon: MessageSquare,
    color: 'from-fuchsia-500 to-pink-500',
    accent: '#E879F9',
    subAgents: ['Chat Interface', 'Critic', 'Chat Modifier', 'Validation gate'],
    sources: [
      { label: 'Chat ChatGPT-style', icon: MessageSquare },
      { label: 'Critic (audit DDL)', icon: Shield },
      { label: 'Chat Modifier', icon: Wand2 },
      { label: 'Approbation utilisateur', icon: CheckCircle2 },
    ],
    detail: {
      what: "L'agent propose le modèle (DDL + graphe). L'utilisateur dialogue en langage naturel pour ajuster ; un Critic auto-audite chaque révision (PK, types, FK, préfixes, SCD2).",
      bullets: [
        "Boucle Critic ↔ Chat Modifier limitée à 4 cycles (anti-loop)",
        "Endpoint /api/chat conserve l'historique et le contexte SQL",
        "Validation explicite via /api/validate avant déploiement",
        "Pause supplémentaire HITL si DQ < 50 → /api/validate-dq",
      ],
      io: { in: 'Modèle proposé', out: 'Modèle validé et signé par l\'utilisateur' },
    },
  },
  {
    n: 4,
    key: 'deploy',
    title: 'Déploiement du Data Warehouse',
    short: 'DDL exécuté, DW instancié',
    icon: Rocket,
    color: 'from-emerald-500 to-teal-500',
    accent: '#10B981',
    subAgents: ['ETL Initializer', 'DDL Generator', 'Pre-flight checks'],
    sources: [
      { label: 'Script DDL T-SQL', icon: FileCode2 },
      { label: 'Pré-flight checks', icon: MonitorCheck },
      { label: 'Création DW cible', icon: Database },
    ],
    detail: {
      what: "Génération d'un script DDL T-SQL complet et formaté, exécuté contre l'instance cible pour matérialiser le DW (DB, schémas, faits, dimensions, vues).",
      bullets: [
        "etl_initializer.py crée DB + tables + vues",
        "etl_tsql_generator.py produit MERGE + procédures usp_*",
        "Préflight de compatibilité version + auto-versioning Docker",
      ],
      io: { in: 'Modèle validé', out: 'DW physique prêt à être chargé' },
    },
  },
  {
    n: 5,
    key: 'etl',
    title: 'Automatisation ETL',
    short: 'Extraction → Transform → Load',
    icon: Workflow,
    color: 'from-amber-500 to-orange-500',
    accent: '#F59E0B',
    subAgents: ['Extractor', 'Transformer', 'Loader', 'Executor'],
    sources: [
      { label: 'Extractor', icon: Search },
      { label: 'Transformer', icon: Cpu },
      { label: 'Loader', icon: Database },
      { label: 'T-SQL MERGE procs', icon: FileCode2 },
    ],
    detail: {
      what: "Trois nœuds ETL orchestrés par LangGraph : Extractor pull la source restaurée, Transformer applique le mapping vers le modèle dimensionnel, Loader écrit le DW cible.",
      bullets: [
        "Génération dynamique de procédures stockées T-SQL (MERGE)",
        "Bulk insert haute perf : pyodbc fast_executemany=True",
        "Mode incrémental piloté par CDC Watermark",
        "Logs d'exécution streamés en SSE temps réel",
      ],
      io: { in: 'DW vide + source', out: 'DW chargé + lineage' },
    },
  },
  {
    n: 6,
    key: 'heal',
    title: 'Maintenance & Self-healing',
    short: 'Détecter, corriger, réessayer',
    icon: Activity,
    color: 'from-rose-500 to-red-500',
    accent: '#F43F5E',
    subAgents: ['Healer', 'Schema Drift', 'Lineage', 'Cataloger', 'Insights'],
    sources: [
      { label: 'Schema Drift Detector', icon: AlertTriangle },
      { label: 'Healer Agent', icon: RefreshCcw },
      { label: 'Lineage Tracker', icon: Network },
      { label: 'Cataloger', icon: Boxes },
      { label: 'Insight Generator', icon: Sparkles },
      { label: 'Query Generator', icon: Bot },
    ],
    detail: {
      what: "Le pipeline est monitoré en continu. Si une erreur ou une dérive est détectée, Healer analyse, propose un correctif DDL/data, et relance — jusqu'à 3 essais.",
      bullets: [
        "Boucle try-heal-retry (MAX_RETRIES=3) sans intervention humaine",
        "Schema Drift Detector compare l'empreinte des sources entre runs",
        "Lineage Tracker construit un DAG source→cible exploitable",
        "Cataloger documente automatiquement le DW (data dictionary)",
        "Insight & Query Generator valident le DW chargé via OLAP",
      ],
      io: { in: 'DW en production', out: 'DW résilient + insights' },
    },
  },
];

const TECH_STACK = [
  { label: 'LangGraph', sub: 'Orchestration agents', tone: 'from-violet-500/20 to-indigo-500/10' },
  { label: 'Pydantic', sub: 'Validation stricte', tone: 'from-emerald-500/20 to-teal-500/10' },
  { label: 'SQLAlchemy + pyodbc', sub: 'Backend extraction', tone: 'from-sky-500/20 to-cyan-500/10' },
  { label: 'FastAPI + SSE', sub: 'API + streaming', tone: 'from-amber-500/20 to-orange-500/10' },
  { label: 'React + Framer Motion', sub: 'Frontend réactif', tone: 'from-fuchsia-500/20 to-pink-500/10' },
  { label: 'Ollama + Gemini', sub: 'LLM multi-provider', tone: 'from-rose-500/20 to-red-500/10' },
];

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

export default function UseCaseFlow() {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [pinned, setPinned] = useState(null);
  const tickRef = useRef(null);
  const lastTickRef = useRef(Date.now());

  useEffect(() => {
    if (!playing || pinned !== null) return;
    tickRef.current = setInterval(() => {
      setActive((prev) => (prev + 1) % STAGES.length);
      lastTickRef.current = Date.now();
    }, 4000);
    return () => clearInterval(tickRef.current);
  }, [playing, pinned]);

  const displayedIdx = pinned !== null ? pinned : active;
  const stage = STAGES[displayedIdx];

  return (
    <div className="relative w-full">
      <div className="text-center max-w-4xl mx-auto px-6 mb-12">
        {/* MODIFICATION ICI : leading-[1.2] et py-2 rajoutés et badge supprimé */}
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-zinc-900 dark:text-white mb-5 leading-[1.2] py-2">
          De la source brute au Data Warehouse,<br/>
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">orchestré par des agents IA.</span>
        </h2>
        <p className="text-base md:text-lg text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-2xl mx-auto">
          Chaque étape est jouée par un ou plusieurs agents spécialisés.
          Cliquez sur une étape pour voir les détails, ou laissez l'animation défiler.
        </p>

        <div className="mt-6 inline-flex items-center gap-2 px-1.5 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
          <button
            onClick={() => { setPlaying(p => !p); setPinned(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider text-white hover:bg-white/10 transition"
          >
            {playing ? <Pause size={12}/> : <Play size={12}/>}
            {playing ? 'Pause' : 'Lecture'}
          </button>
          <button
            onClick={() => { setActive(0); setPinned(null); setPlaying(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider text-zinc-300 hover:bg-white/10 transition"
          >
            <RotateCcw size={12}/> Replay
          </button>
        </div>
      </div>

      <FlowRail
        stages={STAGES}
        activeIdx={displayedIdx}
        onPick={(i) => {
          setPinned((p) => (p === i ? null : i));
          setActive(i);
        }}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={stage.key}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="max-w-6xl mx-auto px-6 mt-12"
        >
          <DetailPanel stage={stage} />
        </motion.div>
      </AnimatePresence>

      <div className="max-w-6xl mx-auto px-6 mt-16">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-md p-6 md:p-8">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-300 mb-1">Stack technique vérifiée</div>
              <div className="text-zinc-300 text-sm">Ce qui tourne réellement sous le capot d'Agent BI</div>
            </div>
            {/* MODIFICATION ICI : Sparkles Icon Removed */}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {TECH_STACK.map((t) => (
              <div key={t.label} className={`rounded-2xl border border-white/10 bg-gradient-to-br ${t.tone} p-3 hover:border-white/20 transition`}>
                <div className="text-sm font-bold text-white">{t.label}</div>
                <div className="text-[11px] text-zinc-300 mt-0.5">{t.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FlowRail({ stages, activeIdx, onPick }) {
  return (
    <div className="relative max-w-7xl mx-auto px-6">
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
           style={{
             backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
             backgroundSize: '40px 40px',
             maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
           }}/>
      <div className="relative grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 z-10">
        {stages.map((s, i) => (
          <StageCard
            key={s.key}
            stage={s}
            index={i}
            isActive={i === activeIdx}
            isPast={i < activeIdx}
            onClick={() => onPick(i)}
          />
        ))}
      </div>
      <svg className="hidden lg:block absolute inset-0 w-full h-full pointer-events-none z-0" preserveAspectRatio="none">
        <defs>
          <linearGradient id="railGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#38BDF8"/>
            <stop offset="33%" stopColor="#8B5CF6"/>
            <stop offset="66%" stopColor="#F59E0B"/>
            <stop offset="100%" stopColor="#F43F5E"/>
          </linearGradient>
          <radialGradient id="dotGrad" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fff" stopOpacity="1"/>
            <stop offset="1" stopColor="#8B5CF6" stopOpacity="0"/>
          </radialGradient>
        </defs>
      </svg>
      <div className="hidden lg:flex absolute top-1/2 left-0 right-0 -translate-y-[60%] pointer-events-none z-0 px-6">
        <ParticleTrack />
      </div>
      <div className="hidden md:flex justify-center mt-6 gap-10 text-[10px] uppercase tracking-[0.2em] font-bold">
        <LoopBadge label="Boucle Critic ↔ Modifier (max 4)" color="#E879F9" />
        <LoopBadge label="Try · Heal · Retry (max 3)" color="#F43F5E" />
      </div>
    </div>
  );
}

function StageCard({ stage, index, isActive, isPast, onClick }) {
  const Icon = stage.icon;
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: 'easeOut' }}
      whileHover={{ y: -4 }}
      className={`group relative rounded-2xl text-left p-4 md:p-5 backdrop-blur-md border transition-all duration-500 overflow-hidden
        ${isActive
          ? 'bg-white/[0.08] border-white/40 shadow-[0_20px_60px_-20px_rgba(139,92,246,0.55)] scale-[1.04]'
          : 'bg-white/[0.025] border-white/10 hover:border-white/25'}
      `}
      style={isActive ? { borderColor: stage.accent + '88' } : {}}
    >
      {isActive && (
        <motion.div
          aria-hidden
          className="absolute -inset-1 rounded-3xl opacity-50 blur-2xl pointer-events-none"
          style={{ background: `radial-gradient(circle at 50% 30%, ${stage.accent}55, transparent 70%)` }}
          animate={{ opacity: [0.35, 0.65, 0.35] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <div className="relative flex items-start justify-between mb-3">
        <span className={`text-[10px] font-black uppercase tracking-[0.25em] ${isActive ? 'text-white' : 'text-zinc-500'}`}>
          N°{stage.n}
        </span>
        {isPast && !isActive && <CheckCircle2 size={14} className="text-emerald-400/80"/>}
        {isActive && (
          <motion.span
            className="text-[9px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full"
            style={{ background: stage.accent + '22', color: stage.accent, border: `1px solid ${stage.accent}55` }}
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          >
            En cours
          </motion.span>
        )}
      </div>
      <div className={`relative w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br ${stage.color} shadow-lg mb-3
        ${isActive ? 'ring-2 ring-white/40' : ''}`}>
        <Icon size={22} className="text-white drop-shadow-md"/>
        {isActive && (
          <motion.div
            aria-hidden
            className="absolute inset-0 rounded-2xl"
            style={{ boxShadow: `0 0 0 0 ${stage.accent}` }}
            animate={{ boxShadow: [`0 0 0 0 ${stage.accent}88`, `0 0 0 10px ${stage.accent}00`] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
      </div>
      <div className="relative">
        <div className={`text-[13px] font-black leading-snug mb-1 ${isActive ? 'text-white' : 'text-zinc-200 group-hover:text-white'}`}>
          {stage.title}
        </div>
        <div className="text-[11px] text-zinc-400 leading-snug">{stage.short}</div>
      </div>
      <div className="relative mt-3 flex flex-wrap gap-1">
        {stage.subAgents.slice(0, 3).map((a) => (
          <span key={a} className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-300">
            {a}
          </span>
        ))}
        {stage.subAgents.length > 3 && (
          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-400">
            +{stage.subAgents.length - 3}
          </span>
        )}
      </div>
      <div className="relative flex items-center justify-end mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight size={14} className="text-zinc-400"/>
      </div>
    </motion.button>
  );
}

function ParticleTrack() {
  const dots = [0, 1, 2, 3, 4];
  return (
    <div className="relative w-full h-1">
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-sky-500/40 via-violet-500/40 to-rose-500/40" />
      {dots.map((d) => (
        <motion.div
          key={d}
          className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
          style={{
            background: 'radial-gradient(circle, #fff 0%, #8B5CF6 60%, transparent 100%)',
            boxShadow: '0 0 12px #8B5CF6, 0 0 24px #8B5CF655',
          }}
          initial={{ left: '0%', opacity: 0 }}
          animate={{ left: ['0%', '100%'], opacity: [0, 1, 1, 0] }}
          transition={{
            duration: 4,
            delay: d * 0.8,
            repeat: Infinity,
            ease: 'linear',
            times: [0, 0.05, 0.95, 1],
          }}
        />
      ))}
    </div>
  );
}

function LoopBadge({ label, color }) {
  return (
    <div className="inline-flex items-center gap-2 text-zinc-400">
      <motion.span
        className="inline-block w-2.5 h-2.5 rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
        animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 1.6, repeat: Infinity }}
      />
      <span className="font-bold">{label}</span>
    </div>
  );
}

function DetailPanel({ stage }) {
  const Icon = stage.icon;
  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.01] backdrop-blur-md overflow-hidden">
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${stage.accent}, transparent)` }}/>
      <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        <div className="lg:col-span-4">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${stage.color} flex items-center justify-center shadow-lg`}>
              <Icon size={22} className="text-white"/>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: stage.accent }}>
                Étape {stage.n}
              </div>
              <div className="text-lg font-bold text-white leading-tight">{stage.title}</div>
            </div>
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed">{stage.detail.what}</p>
          <div className="mt-5 space-y-2">
            <IoChip label="Entrée" value={stage.detail.io.in} accent="#94A3B8"/>
            <IoChip label="Sortie" value={stage.detail.io.out} accent={stage.accent}/>
          </div>
        </div>
        <div className="lg:col-span-4">
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-400 mb-3">Comportement réel</div>
          <ul className="space-y-2.5">
            {stage.detail.bullets.map((b, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 + i * 0.06 }}
                className="flex items-start gap-2.5 text-sm text-zinc-300 leading-snug"
              >
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: stage.accent }}/>
                <span>{b}</span>
              </motion.li>
            ))}
          </ul>
        </div>
        <div className="lg:col-span-4">
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-400 mb-3">
            {stage.n === 1 ? 'Connecteurs supportés' : 'Agents & composants'}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {stage.sources.map((src, i) => {
              const SIcon = src.icon;
              return (
                <motion.div
                  key={src.label}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.05 + i * 0.05 }}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-white/[0.04] border border-white/10 hover:border-white/25 transition"
                >
                  <SIcon size={14} className="shrink-0" style={{ color: stage.accent }}/>
                  <span className="text-[11px] font-semibold text-zinc-200 truncate">{src.label}</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="px-6 md:px-8 pb-6 flex items-center justify-center">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500">
          <ArrowDown size={12} className="animate-bounce"/>
          {stage.n < 6 ? `Étape suivante : ${STAGES[stage.n].title}` : 'Le DW vit, s\'auto-corrige et publie ses insights.'}
        </div>
      </div>
    </div>
  );
}

function IoChip({ label, value, accent }) {
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <span className="inline-block w-12 text-[9px] font-black uppercase tracking-wider text-zinc-500">{label}</span>
      <span className="px-2 py-0.5 rounded-md font-semibold" style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}33` }}>
        {value}
      </span>
    </div>
  );
}