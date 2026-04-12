// src/components/LineageGraph.jsx — Interactive Lineage Flow v2.0
import React, { useMemo, useState, useEffect, useCallback } from 'react';
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
import { motion, AnimatePresence } from 'framer-motion';
import { GitMerge, Database, Star, ArrowRight, Info, Search, Zap, Key, Link as LinkIcon, Hash } from 'lucide-react';
import { usePipelineStore } from '../store/pipelineStore';

// ─── Custom Node Components ──────────────────────────────────────────────────

const LineageNode = ({ data }) => {
  const isSource = data.kind === 'source';
  const isTarget = data.kind === 'target';
  
  return (
    <div className={`p-4 rounded-2xl border transition-all ${
      isSource 
      ? 'bg-slate-900/90 border-slate-700/50 shadow-lg' 
      : 'bg-indigo-600 border-indigo-400 shadow-2xl shadow-indigo-500/20'
    } min-w-[160px]`}>
      {isTarget && <Handle type="target" position={Position.Left} className="w-2 h-2 bg-indigo-500 border-none" />}
      
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
          isSource ? 'bg-white/5 border-white/10 text-slate-500' : 'bg-white/20 border-white/30 text-white'
        }`}>
          {isSource ? <Database size={14} /> : <Star size={14} fill="currentColor" />}
        </div>
        <div className="min-w-0">
          <h4 className="text-[11px] font-black tracking-tight text-white uppercase truncate">{data.label}</h4>
          <p className={`text-[8px] font-black uppercase tracking-widest ${isSource ? 'text-slate-500' : 'text-indigo-200'}`}>
            {data.table}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
         <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${isSource ? 'bg-slate-800 text-slate-500' : 'bg-white/10 text-white'}`}>
            {data.role || 'Field'}
         </span>
      </div>

      {isSource && <Handle type="source" position={Position.Right} className="w-2 h-2 bg-indigo-500 border-none" />}
    </div>
  );
};

const nodeTypes = {
  lineageNode: LineageNode,
};

// ─── Main Component ─────────────────────────────────────────────────────────

export default function LineageGraph() {
  const { lineage, pipelineStatus } = usePipelineStore();
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  useEffect(() => {
    if (!lineage || typeof lineage !== 'object') return;

    const newNodes = [];
    const newEdges = [];
    
    let yOffset = 0;
    const X_GAP = 400;
    const Y_GAP = 120;

    Object.entries(lineage).forEach(([tableName, tableData], tableIdx) => {
        // Pour chaque table, on aligne sources à gauche, targets à droite
        const tableNodes = tableData.nodes || [];
        const tableEdges = tableData.edges || [];

        const sourceNodes = tableNodes.filter(n => n.kind === 'source');
        const targetNodes = tableNodes.filter(n => n.kind === 'target');

        sourceNodes.forEach((node, i) => {
            newNodes.push({
                id: node.id,
                type: 'lineageNode',
                position: { x: 0, y: yOffset + i * Y_GAP },
                data: { ...node }
            });
        });

        targetNodes.forEach((node, i) => {
            newNodes.push({
                id: node.id,
                type: 'lineageNode',
                position: { x: X_GAP, y: yOffset + i * Y_GAP },
                data: { ...node }
            });
        });

        tableEdges.forEach((edge, i) => {
            newEdges.push({
                id: `e-${edge.from}-${edge.to}`,
                source: edge.from,
                target: edge.to,
                animated: true,
                label: edge.transform?.replace(/_/g, ' '),
                labelStyle: { fill: '#6366f1', fontSize: 8, fontWeight: 900 },
                style: { stroke: '#6366f1', strokeWidth: 2, opacity: 0.6 },
            });
        });

        yOffset += Math.max(sourceNodes.length, targetNodes.length) * Y_GAP + 100;
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [lineage]);

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  if (!lineage || nodes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 opacity-40 bg-[#050508]">
        <GitMerge size={32} className="text-slate-600" />
        <div className="text-center">
          <p className="text-[12px] font-black text-slate-500 uppercase tracking-widest">Lineage pending execution</p>
          <p className="text-[10px] text-slate-600 mt-1 uppercase tracking-widest font-bold">
            Data trail will manifest upon ETL success
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#050508] relative">
      {/* HUD Header */}
      <div className="absolute top-6 left-6 z-20 pointer-events-none">
         <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <GitMerge size={16} className="text-indigo-400" />
            </div>
            <h2 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">Neural Lineage</h2>
         </div>
         <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Source-to-Warehouse Provenance Trail</p>
      </div>

      <div className="flex-1 overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          className="bg-dot-pattern"
          colorMode="dark"
        >
          <Background color="#1e1e2d" gap={24} size={1} />
          <Controls className="bg-slate-900 border-white/10 fill-white" />
          <MiniMap 
            nodeColor={n => n.data.kind === 'source' ? '#1e293b' : '#6366f1'} 
            maskColor="rgba(0,0,0,0.6)"
            className="bg-slate-950 border border-white/5"
          />
        </ReactFlow>
      </div>

      {/* Legend Overlay */}
      <div className="absolute bottom-6 left-6 z-20 flex gap-6 px-6 py-4 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl">
         <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
            <span className="text-[9px] font-black text-white uppercase tracking-widest">Source Column</span>
         </div>
         <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
            <span className="text-[9px] font-black text-white uppercase tracking-widest">DW Column</span>
         </div>
         <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-indigo-500/40" />
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Transformation</span>
         </div>
      </div>
    </div>
  );
}
