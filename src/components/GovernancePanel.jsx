import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, ShieldCheck, Lock, Fingerprint, FileCode2, Copy, Check } from 'lucide-react';
import { usePipelineStore } from '../store/pipelineStore';

export default function GovernancePanel() {
  const { governanceReport, maskingSql } = usePipelineStore();
  const [copied, setCopied] = React.useState(false);

  if (!governanceReport) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 font-mono text-xs uppercase tracking-widest p-8 text-center bg-[#050507]">
        No Governance Audit Available
      </div>
    );
  }

  const { pii_columns_detected = [], compliance_score = 0 } = governanceReport;
  const isSecure = compliance_score >= 90;
  
  const handleCopy = () => {
     navigator.clipboard.writeText(maskingSql || governanceReport.masking_sql || '');
     setCopied(true);
     setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6 space-y-6 bg-[#030304]">
      
      {/* Header Stat */}
      <div className="flex items-center justify-between p-6 rounded-[32px] bg-white/[0.02] border border-white/5 relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-[0.03] pointer-events-none">
           <Lock size={160} className={isSecure ? "text-emerald-500" : "text-amber-500"} />
        </div>
        <div>
          <h2 className="text-xl font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
             <ShieldCheck size={24} className={isSecure ? "text-emerald-400" : "text-amber-400"} />
             GDPR / CCPA Audit
          </h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">Data Governance Agent</p>
        </div>
        
        <div className={`flex flex-col items-end`}>
           <div className={`text-4xl font-black italic tracking-tighter ${isSecure ? 'text-emerald-400' : 'text-amber-400'}`}>
              {compliance_score}%
           </div>
           <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Compliance Score</div>
        </div>
      </div>

      {/* PII Detection Table */}
      <div className="space-y-4">
         <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600 flex items-center gap-2 px-2">
            <Fingerprint size={12} /> Detected PII (Personally Identifiable Information)
         </h3>
         
         {pii_columns_detected.length === 0 ? (
            <div className="p-6 rounded-3xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest flex items-center gap-3">
               <ShieldCheck size={16} /> No Sensitive PII Detected in Logical Schema
            </div>
         ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pii_columns_detected.map((pii, idx) => (
                 <div key={idx} className="p-5 rounded-3xl bg-rose-500/5 border border-rose-500/10 hover:border-rose-500/30 transition-all flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                       <div className="flex items-center gap-2">
                          <ShieldAlert size={14} className="text-rose-400" />
                          <span className="text-[11px] font-black text-rose-300 uppercase tracking-widest">{pii.table}</span>
                       </div>
                       <span className="text-[9px] font-black text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full uppercase tracking-tighter">{pii.risk_level} Risk</span>
                    </div>
                    
                    <div className="space-y-1">
                       <div className="text-sm font-bold text-white">{pii.column}</div>
                       <div className="text-[10px] text-zinc-500 font-medium leading-relaxed">{pii.reason}</div>
                    </div>
                    
                    <div className="mt-2 pt-3 border-t border-rose-500/10">
                       <div className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.2em] mb-1">Masking Strategy</div>
                       <div className="text-xs font-medium text-amber-200">{pii.masking_rule}</div>
                    </div>
                 </div>
              ))}
           </div>
         )}
      </div>

      {/* SQL Masking Policy */}
      {(maskingSql || governanceReport.masking_sql) && (
         <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between px-2">
               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-600 flex items-center gap-2">
                  <FileCode2 size={12} /> Secure SQL DDM Policies
               </h3>
               <button 
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-all text-[9px] font-black uppercase tracking-widest"
               >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copied Policy' : 'Copy DDL'}
               </button>
            </div>
            
            <div className="relative group">
               <pre className="p-6 rounded-3xl bg-black/50 border border-white/5 text-[11px] font-mono whitespace-pre-wrap text-emerald-400 leading-relaxed shadow-inner">
                  {maskingSql || governanceReport.masking_sql}
               </pre>
            </div>
         </div>
      )}
    </div>
  );
}
