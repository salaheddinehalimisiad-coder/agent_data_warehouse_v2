import React from 'react';
import { motion } from 'framer-motion';
import { 
  Search, Database, Bot, Shield, 
  ArrowRight, CheckCircle2, Zap 
} from 'lucide-react';

const AGENTS = [
  { id: 'exp', label: 'Explorer', icon: Search, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { id: 'mod', label: 'Modeler', icon: Bot, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  { id: 'crt', label: 'Critic', icon: Shield, color: 'text-rose-400', bg: 'bg-rose-500/10' },
  { id: 'exe', label: 'Executor', icon: Zap, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
];

export default function ProcessDiagram() {
  return (
    <div className="w-full py-20 px-8 bg-zinc-900/30 border border-white/5 rounded-[40px] relative overflow-hidden backdrop-blur-xl">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />
      
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
        {AGENTS.map((agent, i) => (
          <React.Fragment key={agent.id}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.15 }}
              className="flex flex-col items-center group"
            >
              <div className={`w-20 h-20 rounded-3xl ${agent.bg} border border-white/10 flex items-center justify-center mb-4 shadow-2xl transition-transform group-hover:scale-110 group-hover:rotate-3`}>
                <agent.icon size={32} className={`${agent.color} drop-shadow-glow`} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 group-hover:text-white transition-colors">
                {agent.label}
              </span>
            </motion.div>
            
            {i < AGENTS.length - 1 && (
              <motion.div 
                initial={{ width: 0, opacity: 0 }}
                whileInView={{ width: 40, opacity: 1 }}
                transition={{ delay: i * 0.2 + 0.1 }}
                className="hidden md:flex items-center"
              >
                <div className="h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent flex-1 relative">
                  <div className="absolute inset-0 bg-indigo-500/20 blur-sm animate-pulse" />
                </div>
                <ArrowRight size={14} className="text-zinc-600 ml-2" />
              </motion.div>
            )}
          </ React.Fragment>
        ))}
      </div>

      <div className="mt-16 text-center">
        <div className="inline-flex items-center gap-3 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest italic">Neural Pipeline Active</span>
        </div>
      </div>
    </div>
  );
}
