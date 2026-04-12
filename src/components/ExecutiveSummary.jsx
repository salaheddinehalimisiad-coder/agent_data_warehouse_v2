import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Terminal, ShieldCheck, Target, Lightbulb, Copy, Check, BarChart3, PieChart, LineChart } from 'lucide-react';

// ─── Neural Chart Component (Custom SVG + Framer Motion) ─────────────────────
function NeuralChart({ type, title, data }) {
  if (!data || data.length === 0) return null;

  // Extraction simple des clés (on prend la première numérique pour Y, la première textuelle pour X)
  const keys = Object.keys(data[0]);
  const xKey = keys.find(k => typeof data[0][k] === 'string') || keys[0];
  const yKey = keys.find(k => typeof data[0][k] === 'number') || keys[1];

  const maxVal = Math.max(...data.map(d => d[yKey] || 0), 1);

  return (
    <div className="bg-black/40 rounded-3xl border border-white/5 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h5 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2">
           {type === 'bar' ? <BarChart3 size={12} /> : type === 'line' ? <LineChart size={12} /> : <PieChart size={12} />}
           {title}
        </h5>
      </div>

      <div className="h-40 flex items-end gap-2 px-2 pt-4 relative">
        {/* Y Axis Guide Lines */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-white/5" />
        <div className="absolute inset-x-0 top-4 h-px bg-white/5 border-dashed" />
        
        {data.slice(0, 10).map((d, i) => {
          const heightPct = ((d[yKey] || 0) / maxVal) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
              <motion.div 
                initial={{ height: 0 }}
                animate={{ height: `${heightPct}%` }}
                className={`w-full rounded-t-lg bg-gradient-to-t ${
                    i % 2 === 0 ? 'from-indigo-600 to-indigo-400' : 'from-purple-600 to-purple-400'
                } shadow-lg shadow-indigo-500/10 group-hover:brightness-125 transition-all`}
              />
              <span className="text-[8px] font-bold text-zinc-600 truncate w-full text-center">
                {String(d[xKey]).substring(0, 8)}
              </span>
              
              {/* Tooltip on hover */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-black text-[9px] font-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none whitespace-nowrap">
                {d[yKey]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ExecutiveSummary({ content, visualizations = [] }) {
  const [copied, setCopied] = React.useState(null);

  if (!content) return null;

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const sections = content.split('###').filter(s => s.trim());

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center shadow-glow-indigo">
          <Target size={20} className="text-indigo-400" />
        </div>
        <div>
          <h3 className="text-sm font-black text-white italic tracking-tighter uppercase leading-none">Neural Executive Storytelling</h3>
          <p className="text-[9px] text-indigo-500/60 font-bold uppercase tracking-[0.2em] mt-1">Strategic Dashboard Generation</p>
        </div>
      </div>

      {/* DASHBOARD GRID */}
      {visualizations.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             {visualizations.map((viz, i) => (
                <NeuralChart key={i} {...viz} />
             ))}
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((section, idx) => {
          const lines = section.trim().split('\n');
          const title = lines[0].trim();
          const body = lines.slice(1).join('\n').trim();
          
          const isValue = title.toLowerCase().includes('value');
          const isQueries = title.toLowerCase().includes('requêtes') || title.toLowerCase().includes('queries');
          const isHealth = title.toLowerCase().includes('diagnostic') || title.toLowerCase().includes('health');

          return (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              className={`rounded-[32px] p-6 border ${
                isValue ? 'bg-indigo-500/5 border-indigo-500/10 md:col-span-2' :
                isQueries ? 'bg-white/[0.02] border-white/5 md:col-span-2' :
                'bg-emerald-500/5 border-emerald-500/10'
              } relative overflow-hidden group`}
            >
               <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                  {isValue ? <Lightbulb size={120} /> : isQueries ? <Terminal size={120} /> : <ShieldCheck size={120} />}
               </div>

               <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-4">
                  {isValue && <Lightbulb size={12} className="text-indigo-400" />}
                  {isQueries && <Terminal size={12} className="text-amber-400" />}
                  {isHealth && <ShieldCheck size={12} className="text-emerald-400" />}
                  {title}
               </h4>

               <div className="relative z-10">
                  {isQueries ? (
                    <div className="space-y-4">
                       {body.split('- **').filter(q => q.trim()).map((queryBlock, qIdx) => {
                          const [qTitle, qCodeRaw] = queryBlock.split('**:');
                          const qCode = qCodeRaw?.replace(/```sql|```/g, '').trim();
                          return (
                            <div key={qIdx} className="bg-black/40 rounded-2xl border border-white/5 p-4 hover:border-amber-500/30 transition-all">
                               <div className="flex justify-between items-start mb-2">
                                  <p className="text-[11px] font-bold text-amber-200">🔍 {qTitle}</p>
                                  <button 
                                    onClick={() => copyToClipboard(qCode, `query-${qIdx}`)}
                                    className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-white transition-all"
                                  >
                                    {copied === `query-${qIdx}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                  </button>
                               </div>
                               <pre className="text-[10px] font-mono text-zinc-400 whitespace-pre-wrap leading-relaxed">
                                  {qCode}
                               </pre>
                            </div>
                          )
                       })}
                    </div>
                  ) : (
                    <p className="text-[13px] text-zinc-300 leading-relaxed font-medium whitespace-pre-wrap">
                       {body}
                    </p>
                  )}
               </div>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  );
}
