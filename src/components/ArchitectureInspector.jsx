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
  Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { 
  Database, Star, ShieldCheck, ChevronRight, 
  CheckCircle2, XCircle, RefreshCcw, Search,
  Activity, Zap, Info, Key, Link as LinkIcon, Hash
} from 'lucide-react';
import { usePipelineStore } from '../store/pipelineStore';
import SchemaChangesDiff from './SchemaChangesDiff';

// ─── Custom Node Components ──────────────────────────────────────────────────

const TableNode = ({ data }) => {
  const isFact = data.role === 'fact';
  return (
    <div className={`p-4 rounded-3xl border transition-all ${
      isFact 
      ? 'bg-indigo-600 border-indigo-400 shadow-2xl shadow-indigo-500/30' 
      : 'bg-slate-900/90 backdrop-blur-md border-white/10'
    } min-w-[180px]`}>
      <Handle type="target" position={Position.Left} className="w-2 h-2 bg-indigo-500 border-none" />
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
          isFact ? 'bg-white/20 border-white/30 text-white' : 'bg-white/5 border-white/10 text-slate-500'
        }`}>
          {isFact ? <Star size={14} fill="currentColor" /> : <Database size={14} />}
        </div>
        <div className="min-w-0">
          <h4 className="text-[11px] font-black tracking-tight text-white uppercase truncate">{data.label}</h4>
          <p className={`text-[8px] font-black uppercase tracking-widest ${isFact ? 'text-indigo-200' : 'text-slate-500'}`}>
            {isFact ? 'Fact Entity' : 'Dimension'}
          </p>
        </div>
      </div>
      <div className="space-y-1">
        {data.columns?.slice(0, 3).map((col, i) => (
          <div key={i} className="flex items-center gap-2 text-[9px] font-mono text-slate-400">
            <span className={col.role === 'pk' ? 'text-yellow-500' : col.role === 'fk' ? 'text-cyan-400' : 'text-slate-600'}>
              {col.role === 'pk' ? 'PK' : col.role === 'fk' ? 'FK' : '•'}
            </span>
            <span className="truncate">{col.name}</span>
          </div>
        ))}
        {data.columns?.length > 3 && (
          <div className="text-[8px] text-slate-600 italic">+{data.columns.length - 3} more...</div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-indigo-500 border-none" />
    </div>
  );
};

const nodeTypes = {
  tableNode: TableNode,
};

// ─── Sub-Components ─────────────────────────────────────────────────────────

function AgentPipelineSidebar({ PIPELINE_STAGES, agentStatuses, currentAgent }) {
  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] border-r border-white/5 p-4 overflow-y-auto custom-scrollbar">
      <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
        <Activity size={12} /> Orchestration Pipeline
      </h3>
      <div className="space-y-6 relative">
        <div className="absolute left-4 top-2 bottom-2 w-px bg-white/[0.03]" />
        {PIPELINE_STAGES.map((stage, idx) => {
          const isDone = stage.agents.every(a => agentStatuses[a] === 'done');
          const isRunning = stage.agents.some(a => agentStatuses[a] === 'running' || currentAgent === a);
          return (
            <div key={stage.id} className="relative pl-10 flex flex-col gap-1">
              <div className={`absolute left-[13px] top-1.5 w-[7px] h-[7px] rounded-full z-10 border ${
                isDone ? 'bg-emerald-500 border-emerald-400' :
                isRunning ? 'bg-indigo-500 border-indigo-400 animate-pulse' : 'bg-slate-800 border-slate-700'
              }`} />
              <span className={`text-[11px] font-bold ${isRunning ? 'text-white' : isDone ? 'text-slate-400' : 'text-slate-600'}`}>
                {stage.label}
              </span>
              <span className="text-[9px] text-slate-600 font-medium leading-tight">
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
      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-loose">
        Select a node to inspect attributes
      </p>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="h-full flex flex-col bg-[#0a0a0f] border-l border-white/5 p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Entity Metadata</h3>
        <button onClick={onClose} className="p-1 text-slate-600 hover:text-white transition-colors">
          <XCircle size={14} />
        </button>
      </div>

      <div className="flex items-center gap-4 mb-8 shrink-0">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
          table.role === 'fact' ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'bg-white/5 border-white/10 text-slate-500'
        }`}>
          {table.role === 'fact' ? <Star size={20} fill="currentColor" /> : <Database size={20} />}
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-black text-white italic tracking-tighter uppercase truncate">{table.label}</h2>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">
            {table.role === 'fact' ? 'Synchronized Fact' : 'Dimension Entity'}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
        <span className="text-[9px] font-black text-slate-700 uppercase tracking-[0.3em] block mb-4">Schema definition</span>
        {table.columns?.map((col, i) => (
          <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04] transition-all hover:bg-white/[0.04]">
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg border ${
                col.role === 'pk' ? 'bg-yellow-400/10 border-yellow-400/20 text-yellow-500' :
                col.role === 'fk' ? 'bg-cyan-400/10 border-cyan-400/20 text-cyan-400' :
                'bg-white/5 border-white/10 text-slate-600'
              }`}>
                {col.role === 'pk' ? <Key size={10} /> : col.role === 'fk' ? <LinkIcon size={10} /> : <Hash size={10} />}
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-300 font-mono">{col.name}</p>
                <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">{col.role === 'pk' ? 'Primary Key' : col.role === 'fk' ? 'Foreign Key' : 'Attribute'}</p>
              </div>
            </div>
            <span className="text-[9px] font-mono font-bold text-indigo-400/60 uppercase">{(col.type || col.dtype || 'TEXT').split('(')[0]}</span>
          </div>
        ))}

        <div className="mt-8 p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-3">
          <div className="flex items-center gap-2">
            <Info size={12} className="text-indigo-400" />
            <span className="text-[9px] font-black text-white tracking-[0.1em] uppercase">Contextual Insights</span>
          </div>
          <p className="text-[11px] text-slate-500 italic leading-relaxed">
            {table.description || "No specific derivation metadata provided for this entity."}
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
    pipelineStatus, validatePipeline, addMessage 
  } = usePipelineStore();
  
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNodeData, setSelectedNodeData] = useState(null);
  const [reviewComment, setReviewComment] = useState("");
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [viewMode, setViewMode] = useState('graph'); // 'graph' | 'sql'

  // Initialize nodes/edges from logicalModel
  useEffect(() => {
    if (!logicalModel) return;

    const factTable = logicalModel.fact_table;
    const dimTables = logicalModel.dimension_tables || [];

    const newNodes = [];
    const newEdges = [];

    // Fact table at center
    if (factTable) {
      newNodes.push({
        id: factTable.name,
        type: 'tableNode',
        position: { x: 0, y: 0 },
        data: { label: factTable.name, role: 'fact', columns: factTable.columns, description: factTable.description },
      });

      // Dimensions around fact
      dimTables.forEach((dim, i) => {
        const angle = (i / dimTables.length) * 2 * Math.PI;
        const radius = 400;
        newNodes.push({
          id: dim.name,
          type: 'tableNode',
          position: { 
            x: Math.cos(angle) * radius, 
            y: Math.sin(angle) * radius 
          },
          data: { label: dim.name, role: 'dimension', columns: dim.columns, description: dim.description },
        });

        newEdges.push({
          id: `e-${dim.name}-${factTable.name}`,
          source: dim.name,
          target: factTable.name,
          animated: true,
          style: { stroke: '#6366f1', strokeWidth: 2, opacity: 0.4 },
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
    { id: 'ingestion', label: 'Source Audit', subtitle: 'Data profiling & discovery', agents: ['explorer', 'data_quality'] },
    { id: 'drift', label: 'Drift Detection', subtitle: 'Schema evolution monitoring', agents: ['drift_detector'] },
    { id: 'modeling', label: 'Schema Modeling', subtitle: 'Star schema architecture', agents: ['modeler', 'critic'] },
    { id: 'validation', label: 'Human Review', subtitle: 'HITL approval checkpoint', agents: ['human_review', 'chat_modifier'] },
    { id: 'etl', label: 'ETL Execution', subtitle: 'Pipeline orchestration', agents: ['etl_generator', 'etl_executor', 'healer'] },
    { id: 'lineage', label: 'Lineage Tracking', subtitle: 'Data provenance trail', agents: ['lineage_tracker'] },
  ];

  const handleValidate = (ok) => {
    validatePipeline(ok, reviewComment);
    if (!ok) {
       addMessage('user', `Revision requested: ${reviewComment}`);
       setShowCommentBox(false);
       setReviewComment("");
    }
  };

  return (
    <div className="flex h-full w-full bg-[#050508] relative overflow-hidden">
      
      {/* ── Left Sidebar (20%) ──────────────────────────────────────────────── */}
      <div className="w-[20%] h-full shrink-0">
        <AgentPipelineSidebar 
          PIPELINE_STAGES={PIPELINE_STAGES} 
          agentStatuses={agentStatuses} 
          currentAgent={currentAgent} 
        />
      </div>

      {/* ── Center Canvas (60% / Flex) ────────────────────────────────────────── */}
      <div className="flex-1 h-full relative border-r border-white/5 bg-[#08080c]">
        {/* Validation Header/Bar */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-4">
           {pipelineStatus === 'awaiting_review' && (
             <motion.div 
               initial={{ y: -50, opacity: 0 }} 
               animate={{ y: 0, opacity: 1 }}
               className="flex items-center gap-2 p-1.5 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-2xl"
             >
               <button 
                 onClick={() => handleValidate(true)}
                 className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-glow-emerald"
               >
                 <CheckCircle2 size={14} /> Approve Design
               </button>
               <button 
                 onClick={() => setShowCommentBox(!showCommentBox)}
                 className="flex items-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border border-white/10"
               >
                 <RefreshCcw size={14} /> Request Adjustment
               </button>
               <button 
                 onClick={() => handleValidate(false)}
                 className="flex items-center gap-2 px-4 py-2.5 text-rose-400 hover:bg-rose-500/10 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all"
               >
                 <XCircle size={14} /> Reject
               </button>
             </motion.div>
           )}

           {showCommentBox && (
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }}
                className="w-[400px] p-4 rounded-3xl bg-[#0f0f15] border border-indigo-500/30 shadow-2xl"
              >
                 <textarea 
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Describe the requested changes (e.g. 'Add a column for net profit in sales fact', 'Change granularity to daily')..."
                    className="w-full h-24 bg-black/40 border border-white/5 rounded-2xl p-4 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all resize-none"
                 />
                 <div className="flex justify-end mt-3">
                    <button 
                      onClick={() => handleValidate(false)}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 shadow-glow"
                    >
                      Send to Modeler Agent
                    </button>
                 </div>
              </motion.div>
           )}
        </div>

        {/* Canvas HUD */}
        <div className="absolute top-6 left-6 z-20 flex flex-col gap-1 pointer-events-none">
           <h2 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">Architectural Canvas</h2>
           <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Star Schema Modeling Node</p>
        </div>

        {viewMode === 'graph' ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-dot-pattern"
            colorMode="dark"
            style={{ background: '#08080c' }}
          >
            <Background color="#1e1e2d" gap={24} size={1} />
            <Controls className="bg-slate-900 border-white/10 fill-white" />
          </ReactFlow>
        ) : (
          <div className="h-full p-10 overflow-auto custom-scrollbar bg-[#050508] font-mono text-[11px] leading-relaxed text-indigo-300">
            <pre className="p-8 rounded-[32px] bg-white/[0.02] border border-white/5 shadow-2xl">
              {sqlDDL || "-- Aucun DDL généré pour le moment"}
            </pre>
          </div>
        )}

        {/* Diff Overlay */}
        <div className="absolute top-24 left-6 z-20 w-72">
           <SchemaChangesDiff 
              previousDdl={previousSqlDDL} 
              currentDdl={sqlDDL} 
              driftDetails={schemaDriftDetails}
              version={logicalModelVersion}
           />
        </div>

        {/* View Switcher Overlay */}
        <div className="absolute top-6 right-6 z-20 flex bg-black/40 backdrop-blur-xl rounded-xl p-1 border border-white/10">
           <button 
             onClick={() => setViewMode('graph')}
             className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'graph' ? 'bg-indigo-600 text-white shadow-glow' : 'text-slate-500'}`}
           >
             Graph
           </button>
           <button 
             onClick={() => setViewMode('sql')}
             className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'sql' ? 'bg-indigo-600 text-white shadow-glow' : 'text-slate-500'}`}
           >
             SQL
           </button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-6 left-6 z-20 glass-card p-4 rounded-2xl border-white/5 flex gap-6 items-center">
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
        </div>
      </div>

      {/* ── Right Sidebar (20%) ─────────────────────────────────────────────── */}
      <div className="w-[20%] h-full shrink-0">
        <PropertyInspector 
          table={selectedNodeData} 
          onClose={() => setSelectedNodeData(null)} 
        />
      </div>

    </div>
  );
}
