// src/components/ArchitectureInspector.jsx — Premium 3-Pane Architecture Inspector
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  MiniMap, 
  applyNodeChanges, 
  applyEdgeChanges,
  Handle,
  Position,
  ReactFlowProvider,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { 
  Database, Star, ShieldCheck, ChevronRight, 
  CheckCircle2, XCircle, RefreshCcw, Search,
  Activity, Zap, Info, Key, Link as LinkIcon, Hash,
  Maximize, Minimize, Layers
} from 'lucide-react';
import { usePipelineStore } from '../store/pipelineStore';
import SchemaChangesDiff from './SchemaChangesDiff';

// ─── Custom Node Components ──────────────────────────────────────────────────

const TableNode = ({ id, data }) => {
  const { setCenter, fitView, getNode, getZoom } = useReactFlow();
  const isFact = data.role === 'fact';

  const handleHeaderClick = () => {
    const currentZoom = getZoom();
    // If the view is already zoomed in heavily, a second click zooms out to fit everything.
    if (currentZoom > 1.2) {
      fitView({ padding: 0.2, duration: 800 });
    } else {
      // Zoom deeply into this specific node
      const node = getNode(id);
      if (node) {
        const w = 220;
        const h = 30 + ((data.columns?.length || 0) * 16);
        const centerX = node.position.x + (w / 2);
        const centerY = node.position.y + (h / 2);
        setCenter(centerX, centerY, { zoom: 1.8, duration: 800 });
      }
    }
  };

  return (
    <div className={`p-0 rounded-sm shadow-xl border transition-all w-[220px] overflow-hidden`}
      style={{
        background: 'var(--bg-elevated)',
        borderColor: 'var(--blue-500)',
        boxShadow: '0 4px 14px rgba(0,0,0,0.08), 0 0 0 1.5px var(--blue-500)',
      }}>
      <Handle type="target" position={Position.Left} className="w-1.5 h-4 bg-indigo-500/50 border-none -ml-0.5 rounded-none" />
      
      {/* Header - Clickable for Auto-Focus */}
      <div 
        onClick={handleHeaderClick}
        className={`px-3 py-1.5 flex items-center gap-2 border-b cursor-pointer hover:brightness-125 transition-all`}
        style={{
          background: 'var(--blue-500)',
          borderColor: 'var(--blue-400)',
        }}
        title="Double-cliquez pour cibler/dézoomer"
      >
        <div style={{ color: '#fff', opacity: 0.9 }}>
          {isFact ? <Star size={11} fill="white" /> : <Database size={11} color="white" />}
        </div>
        <div className="flex-1 min-w-0">
            <h4 className="text-[11px] font-black tracking-[0.1em] uppercase truncate leading-none" style={{ color: '#fff' }}>{data.label}</h4>
        </div>
      </div>

      {/* Columns List - ULTRA COMPACT */}
      <div className="flex flex-col py-1" style={{ background: 'var(--bg-base)' }}>
        {/* Hierarchies - IN ORANGE */}
        {data.hierarchies?.map((h, idx) => (
          <div key={`h-${idx}`} className="px-3 py-1.5 border-b border-orange-500/20 bg-orange-500/5 mb-1 group">
             <div className="flex items-center gap-1.5 text-orange-400 mb-1">
                <Layers size={9} />
                <span className="text-[8px] font-black uppercase tracking-wider">{h.name}</span>
             </div>
             <div className="flex items-center flex-wrap gap-0.5">
                {h.levels.map((lvl, j) => (
                  <React.Fragment key={j}>
                    <span className="text-[7px] text-orange-600 font-mono truncate max-w-[60px]">{lvl}</span>
                    {j < h.levels.length - 1 && <span className="text-[6px] text-orange-500">→</span>}
                  </React.Fragment>
                ))}
             </div>
          </div>
        ))}

        {data.columns?.map((col, i) => (
          <div key={i} className="flex items-center justify-between px-3 py-[2px] transition-colors gap-4 hover:brightness-110">
            {/* Left side: Icon + Name */}
            <div className="flex items-center gap-2 min-w-0">
               <span className="shrink-0 w-3 flex justify-center text-[10px]">
                 {col.role === 'pk' ? <Key size={9} className="text-yellow-500" /> : col.role === 'fk' ? <LinkIcon size={9} className="text-cyan-400 font-bold" /> : <span className="font-bold text-[8px]" style={{ color: 'var(--text-muted)' }}>#</span>}
               </span>
               <span className={`text-[10px] font-mono truncate tracking-tight font-bold`} style={{ color: col.role === 'pk' ? 'var(--text-primary)' : col.role === 'fk' ? 'var(--cyan-300)' : 'var(--text-secondary)' }}>
                 {col.name}
               </span>
            </div>
            {/* Right side: Type */}
            <span className="text-[8px] font-mono font-bold uppercase shrink-0" style={{ color: 'var(--text-muted)' }}>
               {(col.type || col.dtype || 'TEXT').split('(')[0]}
            </span>
          </div>
        ))}
      </div>
      
      <Handle type="source" position={Position.Right} className="w-1.5 h-4 bg-indigo-500/50 border-none -mr-0.5 rounded-none" />
    </div>
  );
};

const nodeTypes = {
  tableNode: TableNode,
};

// Helper component to recenter graph when entering/exiting Fullscreen modal
const FitViewListener = ({ isFullscreen }) => {
  const { fitView } = useReactFlow();
  useEffect(() => {
    // Wait for CSS transition (duration-500) to complete before recalculating center
    const timer = setTimeout(() => {
      fitView({ padding: 0.2, duration: 800 });
    }, 550);
    return () => clearTimeout(timer);
  }, [isFullscreen, fitView]);
  return null;
};

// ─── Main Inspector Component ─────────────────────────────────────────────────────────

function AgentPipelineSidebar({ PIPELINE_STAGES, agentStatuses, currentAgent }) {
  return (
    <div className="flex flex-col h-full border-r p-4 overflow-y-auto custom-scrollbar"
      style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)' }}>
      <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
        <Activity size={12} /> Pipeline d'Orchestration
      </h3>
      <div className="space-y-6 relative">
        <div className="absolute left-4 top-2 bottom-2 w-px" style={{ background: 'var(--border-subtle)' }} />
        {PIPELINE_STAGES.map((stage, idx) => {
          const isDone = stage.agents.every(a => agentStatuses[a] === 'done');
          const isRunning = stage.agents.some(a => agentStatuses[a] === 'running' || currentAgent === a);
          return (
            <div key={stage.id} className="relative pl-10 flex flex-col gap-1">
              <div className={`absolute left-[13px] top-1.5 w-[7px] h-[7px] rounded-full z-10 border ${
                isDone ? 'bg-emerald-500 border-emerald-400' :
                isRunning ? 'bg-indigo-500 border-indigo-400 animate-pulse' : 'bg-neutral-300 border-neutral-400'
              }`} style={{ background: !isDone && !isRunning ? 'var(--bg-higher)' : undefined, borderColor: !isDone && !isRunning ? 'var(--border-default)' : undefined }} />
              <span className={`text-[11px] font-bold`} style={{ color: isRunning ? 'var(--text-primary)' : isDone ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                {stage.label}
              </span>
              <span className="text-[9px] font-medium leading-tight" style={{ color: 'var(--text-muted)' }}>
                {stage.subtitle}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PropertyInspector({ table, onClose }) {
  if (!table) return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center opacity-40">
      <Search size={24} className="mb-4 text-slate-600" />
      <p className="text-[10px] font-black uppercase tracking-widest leading-loose" style={{ color: 'var(--text-muted)' }}>
        Sélectionnez un nœud pour inspecter les attributs
      </p>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="h-full flex flex-col border-l p-6 overflow-hidden"
      style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)' }}>
      <div className="flex items-center justify-between mb-8 shrink-0">
        <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Métadonnées Entité</h3>
        <button onClick={onClose} className="p-1 transition-colors" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => e.target.style.color='var(--text-primary)'} onMouseLeave={e => e.target.style.color='var(--text-muted)'}>
          <XCircle size={14} />
        </button>
      </div>

      <div className="flex items-center gap-4 mb-8 shrink-0">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
          table.role === 'fact' ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'border text-slate-500'
        }`}
        style={table.role !== 'fact' ? { background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' } : undefined}>
          {table.role === 'fact' ? <Star size={20} fill="currentColor" /> : <Database size={20} />}
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-black italic tracking-tighter uppercase truncate" style={{ color: 'var(--text-primary)' }}>{table.label}</h2>
          <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>
            {table.role === 'fact' ? 'Table de Faits' : 'Entité Dimension'}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
        <span className="text-[9px] font-black uppercase tracking-[0.3em] block mb-4" style={{ color: 'var(--text-dim)' }}>Définition Schéma</span>
        {table.columns?.map((col, i) => (
          <div key={i} className="flex items-center justify-between p-3 rounded-2xl border transition-all"
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-higher)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}>
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg border ${
                col.role === 'pk' ? 'bg-yellow-400/10 border-yellow-400/20 text-yellow-500' :
                col.role === 'fk' ? 'bg-cyan-400/10 border-cyan-400/20 text-cyan-400' :
                'border text-slate-600'
              }`}
              style={col.role !== 'pk' && col.role !== 'fk' ? { background: 'var(--bg-base)', borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' } : undefined}>
                {col.role === 'pk' ? <Key size={10} /> : col.role === 'fk' ? <LinkIcon size={10} /> : <Hash size={10} />}
              </div>
              <div>
                <p className="text-[11px] font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{col.name}</p>
                <p className="text-[8px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{col.role === 'pk' ? 'Clé Primaire' : col.role === 'fk' ? 'Clé Étrangère' : 'Attribut'}</p>
              </div>
            </div>
            <span className="text-[9px] font-mono font-bold text-indigo-400/60 uppercase">{(col.type || col.dtype || 'TEXT').split('(')[0]}</span>
          </div>
        ))}

        <div className="mt-8 p-6 rounded-3xl border space-y-3"
          style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <Info size={12} className="text-indigo-400" />
            <span className="text-[9px] font-black tracking-[0.1em] uppercase" style={{ color: 'var(--text-primary)' }}>Analyses Contextuelles</span>
          </div>
          <p className="text-[11px] italic leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {table.description || "Aucune métadonnée de dérivation spécifique pour cette entité."}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ArchitectureInspector() {
  const { 
    logicalModel, logicalModelVersion, sqlDDL, previousSqlDDL, 
    schemaDriftDetails, agentStatuses, currentAgent, 
    pipelineStatus, pipelineError, validatePipeline, addMessage 
  } = usePipelineStore();
  
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNodeData, setSelectedNodeData] = useState(null);
  const [reviewComment, setReviewComment] = useState("");
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [viewMode, setViewMode] = useState('graph'); // 'graph' | 'sql'
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Initialize nodes/edges from logicalModel
  useEffect(() => {
    if (!logicalModel) return;

    const factTables = logicalModel.fact_tables || [];
    const factTable = logicalModel.fact_table || factTables[0];
    const dimTables = logicalModel.dimension_tables || [];

    const newNodes = [];
    const newEdges = [];

    // Fact table at center
      if (factTable) {
        newNodes.push({
          id: factTable.name,
          type: 'tableNode',
          position: { x: 0, y: 0 },
          data: { 
            label: factTable.name, 
            role: 'fact', 
            columns: factTable.columns, 
            hierarchies: factTable.hierarchies || [],
            description: factTable.description 
          },
        });

      // ─────────────────────────────────────────────────────────────
      // INTELLIGENT CONSTELLATION LAYOUT (STAR SCHEMA)
      // ─────────────────────────────────────────────────────────────
      // We map dimensions into predefined aesthetic "slots" around the central Fact Table 
      // preventing any vertical stacking ("une sur l'autre") and guaranteeing a beautifully balanced star.
      
      const getSlotPosition = (index, dim) => {
         // Dynamically calculate the precise height of the node to avoid overlapping the central Fact Table
         const dimHeight = 30 + ((dim.columns?.length || 0) * 16);
         
         const xOffset = 360; // Distance of the inner ring
         
         switch(index % 6) {
             case 0: return { x: xOffset, y: -(dimHeight + 60) }; // Top-Right
             case 1: return { x: -xOffset, y: -(dimHeight + 60) }; // Top-Left
             case 2: return { x: xOffset, y: 260 }; // Bottom-Right
             case 3: return { x: -xOffset, y: 260 }; // Bottom-Left
             case 4: return { x: -(xOffset + 280), y: -(dimHeight / 2) + 80 }; // Far-Left
             case 5: return { x: (xOffset + 280), y: -(dimHeight / 2) + 80 }; // Far-Right
             default: return { x: 0, y: 0 };
         }
      };

      dimTables.forEach((dim, i) => {
        const position = getSlotPosition(i, dim);

        newNodes.push({
          id: dim.name,
          type: 'tableNode',
          position: position,
          data: { 
            label: dim.name, 
            role: 'dimension', 
            columns: dim.columns, 
            hierarchies: dim.hierarchies || [],
            description: dim.description 
          },
        });

        newEdges.push({
          id: `e-${dim.name}-${factTable.name}`,
          source: dim.name,
          target: factTable.name,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#6366f1', strokeWidth: 1.5, opacity: 0.6 },
        });
      });
    }

    setNodes(newNodes);
    setEdges(newEdges);
  }, [logicalModel]);

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onNodeClick = useCallback((event, node) => {
    setSelectedNodeData(node.data);
  }, []);

  const PIPELINE_STAGES = [
    { id: 'ingestion', label: 'Audit Source', subtitle: 'Profilage & découverte des données', agents: ['explorer', 'data_quality'] },
    { id: 'drift', label: 'Détection Drift', subtitle: 'Surveillance évolution schéma', agents: ['drift_detector'] },
    { id: 'modeling', label: 'Modélisation Schéma', subtitle: 'Architecture star schema', agents: ['modeler', 'critic'] },
    { id: 'validation', label: 'Validation Humaine', subtitle: 'Point de contrôle HITL', agents: ['human_review', 'chat_modifier'] },
    { id: 'etl_gen', label: 'Blueprint ETL', subtitle: 'Génération de code', agents: ['etl_tsql_generator'] },
    { id: 'etl_exec', label: 'Traitement Données', subtitle: 'Extraction → Transformation → Chargement', agents: ['etl_extractor', 'etl_transformer', 'etl_loader', 'healer'] },
    { id: 'post_process', label: 'Finalisation', subtitle: 'Insights & Lignage', agents: ['lineage_tracker', 'cataloger'] },
  ];

  const handleValidate = (ok) => {
    validatePipeline(ok, reviewComment);
    if (!ok) {
       addMessage('user', `Révision demandée : ${reviewComment}`);
       setShowCommentBox(false);
       setReviewComment("");
    }
  };

  return (
    <ReactFlowProvider>
      <div className="flex h-full w-full relative overflow-hidden" style={{ background: 'var(--bg-base)' }}>
        
        {/* ── Left Sidebar (20%) ──────────────────────────────────────────────── */}
      <div className="w-[20%] h-full shrink-0">
        <AgentPipelineSidebar 
          PIPELINE_STAGES={PIPELINE_STAGES} 
          agentStatuses={agentStatuses} 
          currentAgent={currentAgent} 
        />
      </div>

      {/* Fullscreen Backdrop Overlay */}
      {isFullscreen && (
         <div 
           className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-md transition-all duration-500" 
           onClick={() => setIsFullscreen(false)} 
         />
      )}

      {/* ── Center Canvas (Flex / Modal Lightbox) ───────────────────────────── */}
      <div className={`transition-all duration-500 overflow-hidden ${
        isFullscreen 
          ? 'fixed inset-12 z-[100] rounded-[2.5rem] border shadow-[0_0_60px_rgba(0,0,0,0.15)]' 
          : 'flex-1 h-full relative border-r'
      }`}
      style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)' }}>
        {/* Validation Header/Bar */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-4">
           {pipelineStatus === 'awaiting_review' && (
             <motion.div 
               initial={{ y: -50, opacity: 0 }} 
               animate={{ y: 0, opacity: 1 }}
               className="flex items-center gap-2 p-1.5 rounded-2xl backdrop-blur-xl border shadow-2xl"
               style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
             >
               <button 
                 onClick={() => handleValidate(true)}
                 className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-glow-emerald"
                 style={{ background: 'var(--green-500)', color: '#fff' }}
                 onMouseEnter={e => e.currentTarget.style.background='var(--green-400)'}
                 onMouseLeave={e => e.currentTarget.style.background='var(--green-500)'}
               >
                 <CheckCircle2 size={14} /> Approuver le Design
               </button>
               <button 
                 onClick={() => setShowCommentBox(!showCommentBox)}
                 className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border"
                 style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
                 onMouseEnter={e => { e.currentTarget.style.background='var(--bg-higher)'; }}
                 onMouseLeave={e => { e.currentTarget.style.background='var(--bg-elevated)'; }}
               >
                 <RefreshCcw size={14} /> Demander un Ajustement
               </button>
               <button 
                 onClick={() => handleValidate(false)}
                 className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all"
                 style={{ background: 'var(--rose-500)', color: '#fff' }}
                 onMouseEnter={e => { e.currentTarget.style.background='var(--rose-400)'; e.currentTarget.style.color='#fff'; }}
                 onMouseLeave={e => { e.currentTarget.style.background='var(--rose-500)'; e.currentTarget.style.color='#fff'; }}
               >
                 <XCircle size={14} /> Rejeter
               </button>
             </motion.div>
           )}

           {showCommentBox && (
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }}
                className="w-[400px] p-4 rounded-3xl border shadow-2xl"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--blue-400)' }}
              >
                 <textarea 
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Décrivez les changements demandés (ex: 'Ajouter une colonne net_profit dans la table des faits', 'Changer la granularité à journalier')..."
                    className="w-full h-24 border rounded-2xl p-4 text-xs focus:outline-none transition-all resize-none"
                    style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                    onFocus={e => e.currentTarget.style.borderColor='var(--blue-400)'}
                    onBlur={e => e.currentTarget.style.borderColor='var(--border-subtle)'}
                 />
                 <div className="flex justify-end mt-3">
                    <button 
                      onClick={() => handleValidate(false)}
                      className="px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-glow"
                      style={{ background: 'var(--blue-500)', color: '#fff' }}
                      onMouseEnter={e => e.currentTarget.style.background='var(--blue-400)'}
                      onMouseLeave={e => e.currentTarget.style.background='var(--blue-500)'}
                    >
                      Envoyer à l'Agent Modeler
                    </button>
                 </div>
              </motion.div>
           )}
        </div>

        {/* Canvas HUD */}
        <div className="absolute top-6 left-6 z-20 flex flex-col gap-1 pointer-events-none">
           <h2 className="text-xl font-black italic tracking-tighter uppercase leading-none" style={{ color: 'var(--text-primary)' }}>Vue Architecturale</h2>
           <p className="text-[9px] font-black uppercase tracking-[0.3em]" style={{ color: 'var(--text-muted)' }}>Modélisation Star Schema</p>
        </div>

        {viewMode === 'graph' ? (
          !logicalModel ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4">
                <XCircle size={28} className="text-rose-400" />
              </div>
              <h3 className="text-sm font-black text-rose-400 uppercase tracking-widest mb-2">Échec Modélisation Schéma</h3>
              <p className="text-[11px] max-w-md leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {pipelineError || "L'agent Modeler n'a pas produit de schéma en étoile valide. Cela signifie généralement que les métadonnées source étaient vides ou que le LLM a retourné une réponse invalide. Vérifiez les logs du pipeline."}
              </p>
            </div>
          ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.15, maxZoom: 1.25 }}
            minZoom={0.3}
            maxZoom={2.5}
            className="bg-dot-pattern"
          >
            <Background color="var(--border-default)" gap={24} size={1} />
            <Controls style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', fill: 'var(--text-primary)' }} />
            <FitViewListener isFullscreen={isFullscreen} />
          </ReactFlow>
          )
        ) : (
          <div className="h-full p-10 overflow-auto custom-scrollbar font-mono text-[11px] leading-relaxed" style={{ background: 'var(--bg-base)', color: 'var(--blue-500)' }}>
            <pre className="p-8 rounded-[32px] border shadow-2xl" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
              {sqlDDL || "-- Aucun DDL généré pour le moment"}
            </pre>
          </div>
        )}

        {/* Diff Overlay - REMOVED AS PER USER REQUEST */}
        {/* <div className="absolute top-24 left-6 z-20 w-72">
           <SchemaChangesDiff 
              previousDdl={previousSqlDDL} 
              currentDdl={sqlDDL} 
              driftDetails={schemaDriftDetails}
              version={logicalModelVersion}
           />
        </div> */}

        {/* View Switcher Overlay */}
        <div className="absolute top-6 right-6 z-20 flex backdrop-blur-xl rounded-xl p-1 border gap-1 items-center"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
           <button 
             onClick={() => setIsFullscreen(!isFullscreen)}
             className="px-3 py-1.5 rounded-lg transition-all flex items-center justify-center"
             style={{ color: 'var(--text-muted)' }}
             title={isFullscreen ? "Quitter le Plein Écran" : "Plein Écran"}
             onMouseEnter={e => { e.currentTarget.style.color='var(--text-primary)'; e.currentTarget.style.background='var(--bg-higher)'; }}
             onMouseLeave={e => { e.currentTarget.style.color='var(--text-muted)'; e.currentTarget.style.background='transparent'; }}
           >
             {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
           </button>
           
           <div className="w-px h-5 mx-1" style={{ background: 'var(--border-subtle)' }} />

           <button 
             onClick={() => setViewMode('graph')}
             className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'graph' ? 'shadow-glow' : ''}`}
             style={viewMode === 'graph' ? { background: 'var(--blue-500)', color: '#fff' } : { color: 'var(--text-muted)' }}
             onMouseEnter={e => { if(viewMode !== 'graph') { e.currentTarget.style.color='var(--text-primary)'; e.currentTarget.style.background='var(--bg-higher)'; }}}
             onMouseLeave={e => { if(viewMode !== 'graph') { e.currentTarget.style.color='var(--text-muted)'; e.currentTarget.style.background='transparent'; }}}
           >
             Graphe
           </button>
           <button 
             onClick={() => setViewMode('sql')}
             className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'sql' ? 'shadow-glow' : ''}`}
             style={viewMode === 'sql' ? { background: 'var(--blue-500)', color: '#fff' } : { color: 'var(--text-muted)' }}
             onMouseEnter={e => { if(viewMode !== 'sql') { e.currentTarget.style.color='var(--text-primary)'; e.currentTarget.style.background='var(--bg-higher)'; }}}
             onMouseLeave={e => { if(viewMode !== 'sql') { e.currentTarget.style.color='var(--text-muted)'; e.currentTarget.style.background='transparent'; }}}
           >
             Code SQL
           </button>
        </div>

        {/* Legend - REMOVED AS PER USER REQUEST */}
        {/* <div className="absolute bottom-6 left-6 z-20 glass-card p-4 rounded-2xl border-white/5 flex gap-6 items-center">
           <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span className="text-[9px] font-black text-white uppercase tracking-widest">Fact Table</span>
           </div>
           <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Dimension</span>
           </div>
           <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-indigo-500/40" />
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Relationship</span>
           </div>
        </div> */}
      </div>
    </div>
    </ReactFlowProvider>
  );
}
