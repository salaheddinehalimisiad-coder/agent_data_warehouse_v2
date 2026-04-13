// src/components/ExportPanel.jsx — Strategic Deployment & Asset Export (V3 Premium)
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download, FileText, Mail, Check,
  Loader2, X, ChevronRight, AlertTriangle,
  Database, Code2, ShieldCheck, Box, Zap,
  Send, Sparkles, Hash, Wind, Package, DatabaseZap
} from 'lucide-react';
import { usePipelineStore } from '../store/pipelineStore';
import { apiClient } from '../api/client';

function ExportCard({ label, sublabel, icon: Icon, onClick, disabled, loading, success, colorCls }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`group relative w-full flex items-center gap-4 p-4 rounded-3xl border transition-all overflow-hidden ${
        disabled 
        ? 'opacity-20 grayscale border-white/5 cursor-not-allowed'
        : `bg-white/[0.02] border-white/5 hover:border-${colorCls}-500/30 hover:bg-white/[0.04] shadow-sm`
      }`}
    >
      <div className={`p-3 rounded-2xl border transition-all ${
        success ? 'bg-emerald-500 text-white border-emerald-400' :
        loading ? 'bg-white/5 border-white/10' :
        `bg-white/5 border-white/10 text-slate-500 group-hover:bg-${colorCls}-500/10 group-hover:text-${colorCls}-400 group-hover:border-${colorCls}-500/20`
      }`}>
        {loading ? <Loader2 size={18} className="animate-spin" /> : 
         success ? <Check size={18} /> : 
         <Icon size={18} />}
      </div>
      
      <div className="flex-1 text-left">
        <p className={`text-[11px] font-black uppercase tracking-widest ${disabled ? 'text-slate-600' : 'text-white'}`}>{label}</p>
        <p className="text-[9px] text-slate-500 font-medium uppercase tracking-tighter mt-0.5">{sublabel}</p>
      </div>

      <div className="shrink-0 transition-transform group-hover:translate-x-1">
         <ChevronRight size={14} className={disabled ? 'text-slate-800' : 'text-slate-700'} />
      </div>

      {loading && (
        <motion.div 
          layoutId="loadingLine" 
          className="absolute bottom-0 left-0 h-0.5 bg-indigo-500" 
          animate={{ width: ['0%', '100%'] }} 
          transition={{ duration: 1.5, repeat: Infinity }} 
        />
      )}
    </button>
  );
}

export default function ExportPanel({ onClose }) {
  const { sessionId, pipelineStatus, etlStatus, userPrefix, sqlDDL, airflowDag, dbtProject, mockDataSql } = usePipelineStore();
  const [email, setEmail]           = useState('');
  const [includePdf, setIncludePdf] = useState(true);
  const [loading, setLoading]       = useState(null); 
  const [success, setSuccess]       = useState(null);
  const [error, setError]           = useState('');

  const canExport = !!sessionId && ['complete', 'awaiting_review', 'error'].includes(pipelineStatus);

  const flashSuccess = (key) => {
    setSuccess(key);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleDownloadPdf = async () => {
    if (!sessionId) return;
    setLoading('pdf'); setError('');
    try {
      const base = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const resp = await fetch(`${base}/api/export-pdf?session_id=${sessionId}`, {
        headers: apiClient.getHeaders()
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text);
      }
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport_${userPrefix}_${sessionId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      flashSuccess('pdf');
    } catch (e) {
      setError(`PDF Protocol Fault: ${e.message}`);
    } finally {
      setLoading(null);
    }
  };

  const handleDownloadJson = async () => {
    if (!sessionId) return;
    setLoading('json'); setError('');
    try {
      const base = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const resp = await fetch(`${base}/api/export-json?session_id=${sessionId}`, {
        headers: apiClient.getHeaders()
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Status ${resp.status}: ${text}`);
      }
      const data = await resp.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `archive_${userPrefix}_${sessionId.substring(0,8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      flashSuccess('json');
    } catch (e) {
      setError(`JSON Synthesis Fault: ${e.message}`);
    } finally {
      setLoading(null);
    }
  };

  const handleDownloadKtr = async () => {
    if (!sessionId) return;
    setLoading('ktr'); setError('');
    try {
      const base = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const resp = await fetch(`${base}/api/export-ktr?session_id=${sessionId}`, {
        headers: apiClient.getHeaders()
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Status ${resp.status}: ${text}`);
      }
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${userPrefix}_etl_pipeline.ktr`;
      a.click();
      window.URL.revokeObjectURL(url);
      flashSuccess('ktr');
    } catch (e) {
      setError(`KTR Export Fault: ${e.message}`);
    } finally {
      setLoading(null);
    }
  };

  const handleDownloadAirflow = async () => {
    if (!sessionId) return;
    setLoading('airflow'); setError('');
    try {
      const base = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const resp = await fetch(`${base}/api/export-airflow?session_id=${sessionId}`, {
        headers: apiClient.getHeaders()
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Status ${resp.status}: ${text}`);
      }
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${userPrefix}_etl_dag.py`;
      a.click();
      window.URL.revokeObjectURL(url);
      flashSuccess('airflow');
    } catch (e) {
      setError(`Airflow Export Fault: ${e.message}`);
    } finally {
      setLoading(null);
    }
  };

  const handleDownloadDbt = async () => {
    if (!sessionId) return;
    setLoading('dbt'); setError('');
    try {
      const base = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const resp = await fetch(`${base}/api/export-dbt?session_id=${sessionId}`, {
        headers: apiClient.getHeaders()
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Status ${resp.status}: ${text}`);
      }
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${userPrefix}_dbt_project.zip`;
      a.click();
      window.URL.revokeObjectURL(url);
      flashSuccess('dbt');
    } catch (e) {
      setError(`DBT Export Fault: ${e.message}`);
    } finally {
      setLoading(null);
    }
  };

  const handleDownloadSql = () => {
    if (!sqlDDL) return;
    const blob = new Blob([sqlDDL], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schema_${userPrefix}_${sessionId.substring(0,8)}.sql`;
    a.click();
    URL.revokeObjectURL(url);
    flashSuccess('sql');
  };

  const handleDownloadMockData = () => {
    if (!mockDataSql) return;
    const blob = new Blob([mockDataSql], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seed_${userPrefix}_${sessionId.substring(0,8)}.sql`;
    a.click();
    URL.revokeObjectURL(url);
    flashSuccess('mock');
  };

  const handleSendEmail = async () => {
    if (!email.trim() || !sessionId) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Neural Identifier (Email) Invalid');
      return;
    }
    setLoading('email'); setError('');
    try {
      const base = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const resp = await fetch(`${base}/api/notify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, email, include_pdf: includePdf }),
      });
      const data = await resp.json();
      if (data.sent) {
        flashSuccess('email');
      } else {
        setError('Transmission Failed - SMTP Cluster Unreachable');
      }
    } catch (e) {
      setError(`Broadcast Fault: ${e.message}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="bg-[#050507] border border-white/10 rounded-[40px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] w-[360px] overflow-hidden flex flex-col relative group">
      
      {/* Strategic Header */}
      <div className="px-8 py-6 border-b border-white/[0.06] bg-black/40 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
           <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Download size={14} className="text-indigo-400" />
           </div>
           <div>
              <h3 className="text-sm font-black text-white italic tracking-tighter uppercase">Deployment Assets</h3>
              <p className="text-[8px] text-slate-500 font-black tracking-widest uppercase mt-0.5">Session: {sessionId?.substring(0,12)}</p>
           </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-2 rounded-xl text-slate-600 hover:text-white bg-white/5 hover:bg-white/10 transition-all">
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
        
        {!canExport && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 text-[10px] text-amber-400 font-bold uppercase tracking-widest italic animate-pulse">
            <AlertTriangle size={14} className="shrink-0" />
            Launch sequence incomplete
          </div>
        )}

        {/* Export Sectors */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 px-2 mb-2">
             <Box size={14} className="text-slate-600" />
             <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Master Artifacts</span>
          </div>

          <ExportCard 
            label="Neural Intelligence PDF" sublabel="Complete DDL + Quality Audit"
            icon={FileText} colorCls="rose"
            onClick={handleDownloadPdf} disabled={!canExport} loading={loading === 'pdf'} success={success === 'pdf'}
          />

          <ExportCard 
            label="Structural JSON" sublabel="Raw Metadata Synthesis"
            icon={Hash} colorCls="indigo"
            onClick={handleDownloadJson} disabled={!canExport} loading={loading === 'json'} success={success === 'json'}
          />

          <ExportCard 
            label="Logical Schema" sublabel="Raw SQL DDL Structure"
            icon={Database} colorCls="indigo"
            onClick={handleDownloadSql} disabled={!canExport || !sqlDDL} loading={loading === 'sql'} success={success === 'sql'}
          />

          <ExportCard 
            label="Airflow Orchestrator DAG" sublabel="Native Python Scheduling"
            icon={Wind} colorCls="cyan"
            onClick={handleDownloadAirflow} disabled={!canExport || !airflowDag} loading={loading === 'airflow'} success={success === 'airflow'}
          />

          <ExportCard 
            label="dbt Analytics Models" sublabel="SQL Transformation Project"
            icon={Package} colorCls="orange"
            onClick={handleDownloadDbt} disabled={!canExport || !dbtProject} loading={loading === 'dbt'} success={success === 'dbt'}
          />

          <ExportCard 
            label="Mock Data Generator" sublabel="Seed SQL Scripts"
            icon={DatabaseZap} colorCls="pink"
            onClick={handleDownloadMockData} disabled={!canExport || !mockDataSql} loading={loading === 'mock'} success={success === 'mock'}
          />

          <ExportCard 
            label="Pentaho KTR Engine" sublabel="Production ETL Runtime"
            icon={Code2} colorCls="emerald"
            onClick={handleDownloadKtr} disabled={!canExport || etlStatus !== 'success'} loading={loading === 'ktr'} success={success === 'ktr'}
          />
        </div>

        {/* Broadcast System */}
        <div className="space-y-4 pt-4 border-t border-white/5">
           <div className="flex items-center gap-3 px-2 mb-2">
              <Send size={14} className="text-slate-600" />
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Neural Broadcast</span>
           </div>

           <div className="space-y-4">
              <div className="relative group/input">
                 <input
                   type="email" value={email} onChange={e => setEmail(e.target.value)}
                   placeholder="neural@agent.network"
                   disabled={!canExport}
                   className="w-full bg-black border border-white/10 rounded-2xl px-5 py-4 text-xs text-white font-bold tracking-tight focus:border-indigo-500/50 outline-none transition-all placeholder:text-slate-800 disabled:opacity-20 shadow-inner"
                 />
                 <Mail size={14} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-800 group-focus-within/input:text-indigo-500 transition-colors" />
              </div>

              <button 
                onClick={() => setIncludePdf(!includePdf)}
                className="flex items-center justify-between w-full p-2.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all cursor-pointer"
              >
                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Attach Logic PDF</span>
                 <div className={`w-10 h-5 rounded-full transition-all relative ${includePdf ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                    <motion.div animate={{ x: includePdf ? 22 : 4 }} className="absolute top-1 w-3 h-3 rounded-full bg-white shadow-xl" />
                 </div>
              </button>

              <button
                onClick={handleSendEmail}
                disabled={!canExport || !email.trim() || loading === 'email'}
                className="w-full h-14 bg-white text-black font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-[0_10px_30px_rgba(255,255,255,0.1)] hover:shadow-white/20 transition-all hover:bg-slate-100 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-20 italic"
              >
                {loading === 'email' ? <Loader2 size={16} className="animate-spin" /> : 
                 success === 'email' ? <ShieldCheck size={16} className="text-emerald-500" /> : 
                 <Sparkles size={16} className="text-indigo-600" />}
                {success === 'email' ? 'TRANSMITTED' : 'ESTABLISH BROADCAST'}
              </button>
           </div>
        </div>

        {/* Global Fault Report */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
              className="flex items-center gap-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-tight italic"
            >
              <Zap size={14} className="shrink-0 fill-rose-500/20" />
              Fault Detect: {error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Aesthetic Footer */}
      <div className="px-8 py-4 border-t border-white/5 flex items-center justify-between text-[8px] font-black text-slate-800 uppercase tracking-[0.3em] font-mono italic">
         <span>Protocol V3.0 SP1</span>
         <span>SECURE NODE 0127</span>
      </div>
    </div>
  );
}
