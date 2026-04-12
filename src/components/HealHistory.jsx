import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, ShieldCheck, AlertCircle, Wrench, ChevronRight } from 'lucide-react';
import { usePipelineStore } from '../store/pipelineStore';

export default function HealHistory() {
  const { healHistory, etlStatus } = usePipelineStore();

  if (!healHistory || healHistory.length === 0) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="rounded-[24px] border border-indigo-500/20 bg-indigo-500/5 backdrop-blur-xl p-5 mb-6"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center animate-pulse">
          <ShieldCheck size={20} className="text-indigo-400" />
        </div>
        <div>
          <h3 className="text-sm font-black text-white italic tracking-tighter uppercase">Immune System Activity</h3>
          <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest">Auto-Healing Engine Active</p>
        </div>
      </div>

      <div className="space-y-4">
        {healHistory.map((entry, idx) => (
          <div key={idx} className="relative pl-6 pb-2 border-l border-indigo-500/20 last:border-0 last:pb-0">
            <div className="absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black text-indigo-300 uppercase italic">Repair Phase {idx + 1}</span>
              {idx === healHistory.length - 1 && etlStatus === 'success' && (
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/20 uppercase">Fixed</span>
              )}
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed font-medium">
              {entry}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-white/5">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Wrench size={12} className="text-zinc-500" />
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest italic">Status: System Stabilized</span>
            </div>
            <ChevronRight size={14} className="text-zinc-700" />
        </div>
      </div>
    </motion.div>
  );
}
